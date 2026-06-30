import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';
import { applyPlanLimits, isUnlimitedPlan, isProPlan, isPaidPlan } from '../common/util/plan-features';
import { deleteUploadByUrl } from '../uploads/upload-cleanup';
import { getCapabilities } from '../common/util/plan';
import { ResendEmailProvider } from '../notifications/providers/email.provider';
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';
import { format as formatTZ, fromZonedTime, toZonedTime } from 'date-fns-tz';

type DashboardUser = { id: string; role: string; businessId: string | null };

@Injectable()
export class BusinessesService {
  private email = new ResendEmailProvider();

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBusinessDto, ownerId: string) {
    const existing = await this.prisma.business.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already taken');
    const { bookingPageSettings, notificationSettings, ...rest } = dto;
    const business = await this.prisma.business.create({
      data: {
        ...rest,
        bookingPageSettings: (bookingPageSettings ?? {}) as Prisma.InputJsonValue,
        notificationSettings: (notificationSettings ?? {}) as Prisma.InputJsonValue,
      },
    });
    await this.prisma.user.update({
      where: { id: ownerId },
      data: { businessId: business.id, role: 'OWNER' },
    });

    // Anti-duplicate: flag the new account if another business shares the same normalized
    // name + phone. Never blocks signup — just sets suspectedDuplicateOfId for admin review.
    await this.flagIfDuplicate(business.id, dto.name, dto.phone ?? null);

    return business;
  }

  private async flagIfDuplicate(newId: string, name: string, phone: string | null) {
    try {
      const normPhone = phone?.replace(/\D/g, '') ?? '';
      const normName = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      if (!normName) return;

      // Load recent businesses to compare in-memory (avoid unindexed LIKE scans).
      const candidates = await this.prisma.business.findMany({
        where: {
          id: { not: newId },
          ...(normPhone.length >= 7 ? { phone: { contains: normPhone.slice(-7) } } : {}),
        },
        select: { id: true, name: true, phone: true },
        take: 50,
      });

      const matched = candidates.find((c) => {
        const cNorm = c.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        return cNorm === normName;
      });

      if (matched) {
        await this.prisma.business.update({
          where: { id: newId },
          data: { suspectedDuplicateOfId: matched.id },
        });
      }
    } catch { /* duplicate check is best-effort; never block account creation */ }
  }

  async findOne(id: string) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Business not found');
    return { ...business, capabilities: getCapabilities(business.plan) };
  }

  async dismissOnboarding(id: string) {
    await this.prisma.business.update({ where: { id }, data: { onboardingDismissed: true } });
    return { ok: true };
  }

  private zonedBounds(now: Date, timezone: string) {
    const localNow = toZonedTime(now, timezone);
    const today = formatTZ(localNow, 'yyyy-MM-dd', { timeZone: timezone });
    const weekStart = formatTZ(startOfWeek(localNow), 'yyyy-MM-dd', { timeZone: timezone });
    const weekEnd = formatTZ(endOfWeek(localNow), 'yyyy-MM-dd', { timeZone: timezone });
    const monthStart = formatTZ(startOfMonth(localNow), 'yyyy-MM-dd', { timeZone: timezone });
    const monthEnd = formatTZ(endOfMonth(localNow), 'yyyy-MM-dd', { timeZone: timezone });

    return {
      todayStart: fromZonedTime(`${today}T00:00:00.000`, timezone),
      todayEnd: fromZonedTime(`${today}T23:59:59.999`, timezone),
      weekStart: fromZonedTime(`${weekStart}T00:00:00.000`, timezone),
      weekEnd: fromZonedTime(`${weekEnd}T23:59:59.999`, timezone),
      monthStart: fromZonedTime(`${monthStart}T00:00:00.000`, timezone),
      monthEnd: fromZonedTime(`${monthEnd}T23:59:59.999`, timezone),
    };
  }

  private async appointmentScope(businessId: string, user: DashboardUser): Promise<Prisma.AppointmentWhereInput> {
    const where: Prisma.AppointmentWhereInput = { businessId };
    if (user.role === 'STAFF') {
      const staff = await this.prisma.staff.findFirst({
        where: { userId: user.id, businessId, active: true },
        select: { id: true },
      });
      where.staffId = staff?.id ?? '__no_staff__';
    }
    return where;
  }

  async dashboardOverview(id: string, user: DashboardUser, locationId?: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      select: { id: true, timezone: true, verificationStatus: true, stripeConnectOnboarded: true },
    });
    if (!business) throw new NotFoundException('Business not found');
    if (user.role !== 'ADMIN' && user.businessId !== id) {
      throw new ForbiddenException('You do not have access to this business');
    }

    const isStaff = user.role === 'STAFF';
    const now = new Date();
    const bounds = this.zonedBounds(now, business.timezone ?? 'UTC');
    const scopedAppointments = await this.appointmentScope(id, user);
    // Optional multi-location scope: when the owner focuses one branch, every
    // appointment-derived metric below filters to it (revenue too, via the
    // appointment relation). No locationId = unchanged business-wide behavior.
    if (locationId) scopedAppointments.locationId = locationId;
    const revenueLocationFilter = locationId ? { appointment: { locationId } } : {};
    const appointmentInclude = {
      client: true,
      service: true,
      staff: { include: { user: true } },
      business: true,
      location: { select: { id: true, name: true } },
    };

    const [
      todayAppointments,
      upcomingAppointments,
      pendingBookings,
      weekCompletedAppointments,
      cancelledThisWeek,
      noShowsThisMonth,
      unreadNotifications,
      unreadMessageRows,
    ] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { ...scopedAppointments, startsAt: { gte: bounds.todayStart, lte: bounds.todayEnd } },
        include: appointmentInclude,
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.appointment.findMany({
        where: {
          ...scopedAppointments,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startsAt: { gt: bounds.todayEnd },
        },
        include: appointmentInclude,
        orderBy: { startsAt: 'asc' },
        take: 5,
      }),
      this.prisma.appointment.count({ where: { ...scopedAppointments, status: 'PENDING' } }),
      this.prisma.appointment.findMany({
        where: {
          ...scopedAppointments,
          status: 'COMPLETED',
          startsAt: { gte: bounds.weekStart, lte: bounds.weekEnd },
        },
        select: { service: { select: { name: true } } },
      }),
      this.prisma.appointment.count({
        where: {
          ...scopedAppointments,
          status: 'CANCELLED',
          startsAt: { gte: bounds.weekStart, lte: bounds.weekEnd },
        },
      }),
      this.prisma.appointment.count({
        where: {
          ...scopedAppointments,
          status: 'NO_SHOW',
          startsAt: { gte: bounds.monthStart, lte: bounds.monthEnd },
        },
      }),
      this.prisma.notification.count({ where: { userId: user.id, read: false } }),
      this.prisma.message.findMany({
        where: {
          businessId: id,
          fromClient: true,
          ...(isStaff
            ? { client: { appointments: { some: { businessId: id, staff: { userId: user.id, active: true } } } } }
            : {}),
        },
        select: { clientId: true, createdAt: true },
      }),
    ]);

    const states = await this.prisma.messageThreadState.findMany({ where: { businessId: id, userId: user.id } });
    const stateByClient = new Map(states.map((state) => [state.clientId, state]));
    let unreadMessages = 0;
    const unreadThreads = new Set<string>();
    for (const message of unreadMessageRows) {
      const state = stateByClient.get(message.clientId);
      if (state?.archivedAt) continue;
      if (!state?.lastReadAt || message.createdAt > state.lastReadAt) {
        unreadMessages += 1;
        unreadThreads.add(message.clientId);
      }
    }

    let weekRevenue = 0;
    let failedPayments = 0;
    let waitlistCount = 0;
    let failedDeliveries = 0;
    let newClientsThisMonth = 0;
    // Owner activation checklist (business-wide, unaffected by location scope).
    let setup: { hasService: boolean; stripeConnected: boolean; hasBooking: boolean; isVerified: boolean } | null = null;
    if (!isStaff) {
      const [payments, waitlist, deliveries, clients, serviceCount, apptCount] = await Promise.all([
        this.prisma.payment.findMany({
          where: {
            businessId: id,
            createdAt: { gte: bounds.weekStart, lte: bounds.weekEnd },
            status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED'] },
            ...revenueLocationFilter,
          },
          select: { amountCents: true, refundedCents: true },
        }),
        this.prisma.waitlistEntry.count({ where: { businessId: id, status: 'WAITING' } }),
        this.prisma.notificationDelivery.count({ where: { businessId: id, status: 'FAILED' } }),
        this.prisma.client.count({ where: { businessId: id, createdAt: { gte: bounds.monthStart, lte: bounds.monthEnd } } }),
        this.prisma.service.count({ where: { businessId: id } }),
        this.prisma.appointment.count({ where: { businessId: id } }),
      ]);
      weekRevenue = payments.reduce((sum, payment) => sum + payment.amountCents - payment.refundedCents, 0);
      failedPayments = await this.prisma.payment.count({ where: { businessId: id, status: 'FAILED', ...revenueLocationFilter } });
      waitlistCount = waitlist;
      failedDeliveries = deliveries;
      newClientsThisMonth = clients;
      setup = {
        hasService: serviceCount > 0,
        stripeConnected: business.stripeConnectOnboarded,
        hasBooking: apptCount > 0,
        isVerified: business.verificationStatus === 'VERIFIED',
      };
    }

    const serviceCounts = weekCompletedAppointments.reduce<Record<string, number>>((acc, apt) => {
      acc[apt.service.name] = (acc[apt.service.name] ?? 0) + 1;
      return acc;
    }, {});
    const topService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      timezone: business.timezone,
      verificationStatus: business.verificationStatus,
      setup,
      today: todayAppointments,
      upcoming: upcomingAppointments,
      metrics: {
        weekRevenue,
        completedThisWeek: weekCompletedAppointments.length,
        newClientsThisMonth,
        pendingBookings,
        cancelledThisWeek,
        noShowsThisMonth,
        topService,
        unreadNotifications,
        unreadMessages,
        unreadThreads: unreadThreads.size,
        failedPayments,
        waitlistCount,
        failedDeliveries,
      },
    };
  }

  async findBySlug(slug: string) {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  private publicBusiness(business: any) {
    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      phone: business.phone,
      timezone: business.timezone,
      address: business.address,
      logoUrl: business.logoUrl,
      websiteUrl: business.websiteUrl,
      instagramUrl: business.instagramUrl,
      facebookUrl: business.facebookUrl,
      tiktokUrl: business.tiktokUrl,
      postVisitMessage: business.postVisitMessage,
      bookingPageSettings: business.bookingPageSettings,
      intakeQuestions: business.intakeQuestions,
      taxRatePercent: business.taxRatePercent,
      minNoticeMinutes: business.minNoticeMinutes,
      maxAdvanceDays: business.maxAdvanceDays,
      maxAdvanceMinutes: business.maxAdvanceMinutes,
      cancellationWindowHours: business.cancellationWindowHours,
      cancellationWindowMinutes: business.cancellationWindowMinutes,
      requireDeposit: business.requireDeposit,
      depositPercent: business.depositPercent,
      collectCardOnFile: business.collectCardOnFile,
      allowClientReschedule: business.allowClientReschedule,
      cancellationPolicy: business.cancellationPolicy,
      currency: business.currency,
      verificationStatus: business.verificationStatus,
      stripeConnectOnboarded: business.stripeConnectOnboarded,
    };
  }

  // Public booking page: omit internal/sensitive fields (contact email, plan,
  // subscription expiry) — keep only what the booking flow legitimately needs.
  async findBySlugPublic(slug: string) {
    const business = await this.findBySlug(slug);
    // A deactivated business is hidden from the public — its booking page reads
    // as "not found" so no new bookings can come in while it's paused.
    if (business.suspended) throw new NotFoundException('This business is not currently accepting online bookings');
    const [locations, reviewAgg, hours] = await Promise.all([
      this.prisma.location.findMany({
        where: { businessId: business.id, active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, address: true },
      }),
      this.prisma.review.aggregate({
        where: { businessId: business.id, published: true },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.businessHours.findMany({
        where: { businessId: business.id },
        orderBy: { dayOfWeek: 'asc' },
        select: { dayOfWeek: true, startTime: true, endTime: true },
      }),
    ]);
    const reviewCount = reviewAgg._count;
    const averageRating = reviewCount > 0 ? Number((reviewAgg._avg.rating ?? 0).toFixed(1)) : null;
    return { ...this.publicBusiness(business), locations, reviewCount, averageRating, hours };
  }

  async findPublicById(id: string) {
    const business = await this.findOne(id);
    if (business.suspended) throw new NotFoundException('This business is not currently accepting online bookings');
    const [locations, reviewAgg] = await Promise.all([
      this.prisma.location.findMany({
        where: { businessId: business.id, active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, address: true },
      }),
      this.prisma.review.aggregate({
        where: { businessId: business.id, published: true },
        _avg: { rating: true },
        _count: true,
      }),
    ]);
    const reviewCount = reviewAgg._count;
    const averageRating = reviewCount > 0 ? Number((reviewAgg._avg.rating ?? 0).toFixed(1)) : null;
    return { ...this.publicBusiness(business), locations, reviewCount, averageRating };
  }

  // Sitemap: public slugs for all active, non-suspended businesses.
  // Rate-limited at the controller layer; no auth required.
  async getPublicSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.prisma.business.findMany({
      where: { suspended: false },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 10_000,
    });
  }

  // Owner pauses their business: keeps all data, hides the public booking page,
  // and stops new public bookings. Fully reversible via reactivate().
  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.business.update({ where: { id }, data: { suspended: true } });
  }

  async reactivate(id: string) {
    await this.findOne(id);
    return this.prisma.business.update({ where: { id }, data: { suspended: false } });
  }

  // Permanent, irreversible account deletion: erases the business and ALL of its
  // data (clients, bookings, staff, catalogue, payments, the owner's user, …).
  // Requires the owner to type the business name back as a safety confirmation.
  // Order matters: appointments first (they Restrict staff/service/client deletes),
  // then everything else, then the users, then the business itself.
  async deleteAccount(id: string, confirmation: string) {
    const business = await this.findOne(id);
    if (confirmation.trim().toLowerCase() !== business.name.trim().toLowerCase()) {
      throw new BadRequestException('Type your business name exactly to confirm deletion.');
    }
    const users = await this.prisma.user.findMany({
      where: { businessId: id },
      select: { id: true, email: true, name: true },
    });
    const userIds = users.map((u) => u.id);

    // Keep email details before wiping users; send only after deletion succeeds.
    const owner = users.find((u) => u.email);

    const byBiz = { where: { businessId: id } };
    await this.prisma.$transaction(async (tx) => {
      // appointment-scoped + appointments (clears the Restrict edges)
      await tx.refund.deleteMany(byBiz);
      await tx.payment.deleteMany(byBiz);
      await tx.review.deleteMany(byBiz);
      await tx.message.deleteMany(byBiz);
      await tx.serviceDue.deleteMany(byBiz);
      await tx.appointment.deleteMany(byBiz);
      // catalogue / people / everything else owned by the business (their
      // grandchildren — staffServices, availability, redemptions — cascade)
      await tx.waitlistEntry.deleteMany(byBiz);
      await tx.clientPackage.deleteMany(byBiz);
      await tx.invoice.deleteMany(byBiz);
      await tx.staffTask.deleteMany(byBiz);
      await tx.giftCard.deleteMany(byBiz);
      await tx.package.deleteMany(byBiz);
      await tx.offer.deleteMany(byBiz);
      await tx.campaign.deleteMany(byBiz);
      await tx.transaction.deleteMany(byBiz);
      await tx.subscription.deleteMany(byBiz);
      await tx.uploadedFile.deleteMany(byBiz);
      await tx.googleCalendarConnection.deleteMany(byBiz);
      await tx.notificationDelivery.deleteMany(byBiz);
      await tx.client.deleteMany(byBiz);
      await tx.service.deleteMany(byBiz);
      await tx.serviceCategory.deleteMany(byBiz);
      await tx.resource.deleteMany(byBiz);
      await tx.location.deleteMany(byBiz);
      await tx.dataErasureRequest.deleteMany(byBiz);
      await tx.privacyConsent.deleteMany(byBiz);
      await tx.staff.deleteMany(byBiz);
      // user-scoped rows for the owner + any staff users in this business
      if (userIds.length) {
        const byUser = { where: { userId: { in: userIds } } };
        await tx.auditLog.deleteMany(byUser);
        await tx.deviceToken.deleteMany(byUser);
        await tx.loginEvent.deleteMany(byUser);
        await tx.notification.deleteMany(byUser);
        await tx.otpChallenge.deleteMany(byUser);
        await tx.refreshSession.deleteMany(byUser);
      }
      await tx.user.deleteMany({ where: { businessId: id } });
      await tx.business.delete({ where: { id } });
    });

    if (owner?.email) {
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      this.email.send({
        to: owner.email,
        subject: `Your ${esc(business.name)} account has been deleted`,
        html: `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
          <tr><td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
              <tr><td style="background:#E9A23C;padding:24px 32px">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF">Account Deleted</h1>
              </td></tr>
              <tr><td style="padding:32px">
                <p style="margin:0 0 16px;font-size:15px;color:#374151">Hi ${esc(owner.name ?? 'there')},</p>
                <p style="margin:0 0 16px;font-size:15px;color:#374151">
                  Your <strong>${esc(business.name)}</strong> account and all associated data have been permanently deleted from Pulse Appointments.
                </p>
                <p style="margin:0 0 16px;font-size:15px;color:#374151">
                  This action is irreversible. All bookings, client records, invoices, and staff accounts have been removed.
                </p>
                <p style="margin:0;font-size:14px;color:#6B7280">
                  If this was a mistake or you have questions, please contact us at support@pulseappointments.com.
                </p>
              </td></tr>
              <tr><td style="padding:16px 32px;border-top:1px solid #E5E7EB;text-align:center">
                <p style="margin:0;font-size:12px;color:#9CA3AF">Pulse Appointments &bull; Thank you for using our service</p>
              </td></tr>
            </table>
          </td></tr>
        </table>`,
      }).catch(() => {});
    }
    return { deleted: true };
  }

  private async assertLocation(businessId: string, locationId?: string) {
    if (!locationId) return;
    await this.prisma.location.findFirstOrThrow({ where: { id: locationId, businessId }, select: { id: true } });
  }

  async getHours(businessId: string, locationId?: string) {
    await this.assertLocation(businessId, locationId);
    const [hours, closures] = await Promise.all([
      (this.prisma.businessHours as any).findMany({ where: { businessId, locationId: locationId ?? null }, orderBy: { dayOfWeek: 'asc' } }),
      (this.prisma.businessClosure as any).findMany({ where: { businessId, locationId: locationId ?? null }, orderBy: { startsAt: 'asc' } }),
    ]);
    return { hours, closures };
  }

  async setHours(businessId: string, rules: { dayOfWeek: number; startTime: string; endTime: string }[], locationId?: string) {
    await this.assertLocation(businessId, locationId);
    await (this.prisma.businessHours as any).deleteMany({ where: { businessId, locationId: locationId ?? null } });
    if (rules.length > 0) {
      await this.prisma.businessHours.createMany({
        data: rules.map((r) => ({ businessId, locationId: locationId ?? null, dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime })),
        skipDuplicates: true,
      });
    }
    return this.getHours(businessId, locationId);
  }

  async addClosure(businessId: string, body: { startsAt: string; endsAt: string; reason?: string }, locationId?: string) {
    await this.assertLocation(businessId, locationId);
    const closure = await (this.prisma.businessClosure as any).create({
      data: {
        businessId,
        locationId: locationId ?? null,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        reason: body.reason ?? null,
      },
    });
    return closure;
  }

  async removeClosure(businessId: string, closureId: string) {
    await this.prisma.businessClosure.deleteMany({ where: { id: closureId, businessId } });
    return { ok: true };
  }

  async update(id: string, dto: UpdateBusinessDto) {
    const current = await this.findOne(id);
    const { bookingPageSettings, notificationSettings, ...rest } = dto;
    const limited = applyPlanLimits(current.plan, rest);
    const data = {
      ...limited,
      ...(limited.maxAdvanceMinutes !== undefined
        ? { maxAdvanceDays: Math.max(1, Math.ceil(limited.maxAdvanceMinutes / 1440)) }
        : {}),
      ...(limited.cancellationWindowMinutes !== undefined
        ? { cancellationWindowHours: Math.floor(limited.cancellationWindowMinutes / 60) }
        : {}),
    };
    // Branding removal (hidePouredBy) is UNLIMITED-only; strip it for lower tiers
    // so a direct API call can't bypass the frontend gate.
    let safeBookingPageSettings = bookingPageSettings;
    if (safeBookingPageSettings !== undefined) {
      const s = safeBookingPageSettings as Record<string, unknown>;
      if (s.hidePouredBy === true && !isUnlimitedPlan(current.plan)) {
        throw new ForbiddenException('Removing Pulse branding requires an Unlimited plan.');
      }
    }

    const result = await this.prisma.business.update({
      where: { id },
      data: {
        ...data,
        ...(safeBookingPageSettings !== undefined
          ? { bookingPageSettings: safeBookingPageSettings as Prisma.InputJsonValue }
          : {}),
        ...(notificationSettings !== undefined
          ? { notificationSettings: notificationSettings as Prisma.InputJsonValue }
          : {}),
      },
    });
    if (limited.logoUrl !== undefined && current.logoUrl && current.logoUrl !== limited.logoUrl) {
      await deleteUploadByUrl(this.prisma, current.logoUrl);
    }
    return result;
  }

  async getReports(businessId: string, locationId?: string) {
    const biz = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { plan: true, currency: true } });
    if (!isPaidPlan(biz.plan)) {
      return { gated: true, plan: biz.plan };
    }

    // Optional single-branch scope. Appointment-derived metrics and revenue
    // (via the payment->appointment relation) filter to the branch; client
    // metrics (top clients, new clients) stay business-wide — a client isn't
    // tied to one location — and are labelled as such in the UI.
    const apptLoc = locationId ? { locationId } : {};
    const payLoc = locationId ? { appointment: { locationId } } : {};

    const now = new Date();
    // Month buckets: last 12 calendar months (current month + 11 prior).
    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
    }

    const [bookingCounts, revenueByMonth, topServices, topStaff, topClients, revenueProtected] = await Promise.all([
      // All-time booking outcome counts
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: { businessId, ...apptLoc },
        _count: { _all: true },
      }),

      // Collected revenue net of refunds, grouped by year+month, last 12 months
      this.prisma.payment.findMany({
        where: {
          businessId,
          status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED'] },
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) },
          ...payLoc,
        },
        select: { amountCents: true, refundedCents: true, createdAt: true, kind: true },
      }),

      // Top 5 services by completed bookings
      this.prisma.appointment.groupBy({
        by: ['serviceId'],
        where: { businessId, status: 'COMPLETED', ...apptLoc },
        _count: { _all: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: 5,
      }),

      // Top 5 staff by total bookings
      this.prisma.appointment.groupBy({
        by: ['staffId'],
        where: { businessId, ...apptLoc },
        _count: { _all: true },
        orderBy: { _count: { staffId: 'desc' } },
        take: 5,
      }),

      // Top 5 clients by total spent
      this.prisma.client.findMany({
        where: { businessId },
        select: {
          id: true, name: true,
          payments: {
            where: { status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED'] } },
            select: { amountCents: true, refundedCents: true },
          },
          appointments: { where: { status: 'COMPLETED' }, select: { id: true } },
        },
        orderBy: { payments: { _count: 'desc' } },
        take: 20,
      }),

      // Revenue protected breakdown
      this.prisma.payment.findMany({
        where: {
          businessId,
          status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED'] },
          kind: { in: ['DEPOSIT', 'NO_SHOW_FEE', 'LATE_CANCEL_FEE'] },
          ...payLoc,
        },
        select: { amountCents: true, refundedCents: true, kind: true },
      }),
    ]);

    // Resolve service names
    const serviceIds = topServices.map(s => s.serviceId);
    const staffIds = topStaff.map(s => s.staffId);
    const [serviceNames, staffNames] = await Promise.all([
      this.prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } }),
      this.prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, user: { select: { name: true } } } }),
    ]);
    const svcMap = new Map(serviceNames.map(s => [s.id, s.name]));
    const stfMap = new Map(staffNames.map(s => [s.id, s.user.name]));

    // Build outcome summary
    const outcomes = { total: 0, completed: 0, cancelled: 0, noShow: 0, pending: 0, confirmed: 0 };
    for (const g of bookingCounts) {
      const n = g._count._all;
      outcomes.total += n;
      if (g.status === 'COMPLETED') outcomes.completed = n;
      else if (g.status === 'CANCELLED') outcomes.cancelled = n;
      else if (g.status === 'NO_SHOW') outcomes.noShow = n;
      else if (g.status === 'PENDING') outcomes.pending = n;
      else if (g.status === 'CONFIRMED') outcomes.confirmed = n;
    }

    // Revenue by month
    const monthMap = new Map<string, number>();
    for (const p of revenueByMonth) {
      const key = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, (monthMap.get(key) ?? 0) + p.amountCents - (p.refundedCents ?? 0));
    }
    const byMonth = months.map(m => ({ label: m.label, cents: monthMap.get(m.label) ?? 0 }));

    // Total collected
    const collectedCents = revenueByMonth.reduce((s, p) => s + p.amountCents - (p.refundedCents ?? 0), 0);

    // Revenue protected breakdown
    const depositsCollectedCents = revenueProtected.filter(p => p.kind === 'DEPOSIT').reduce((s, p) => s + p.amountCents - (p.refundedCents ?? 0), 0);
    const noShowFeesCents = revenueProtected.filter(p => p.kind === 'NO_SHOW_FEE').reduce((s, p) => s + p.amountCents - (p.refundedCents ?? 0), 0);
    const cancelFeesCents = revenueProtected.filter(p => p.kind === 'LATE_CANCEL_FEE').reduce((s, p) => s + p.amountCents - (p.refundedCents ?? 0), 0);
    const revenueProtectedCents = depositsCollectedCents + noShowFeesCents + cancelFeesCents;

    // Top clients by spend
    const clientsWithSpend = topClients
      .map(c => ({
        id: c.id, name: c.name,
        totalSpentCents: c.payments.reduce((s, p) => s + p.amountCents - (p.refundedCents ?? 0), 0),
        totalVisits: c.appointments.length,
      }))
      .sort((a, b) => b.totalSpentCents - a.totalSpentCents)
      .filter(c => c.totalSpentCents > 0)
      .slice(0, 5);

    // New clients (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const newClients30d = await this.prisma.client.count({ where: { businessId, createdAt: { gte: thirtyDaysAgo } } });

    return {
      gated: false,
      plan: biz.plan,
      currency: biz.currency ?? 'CAD',
      locationScoped: !!locationId,
      outcomes,
      collectedCents,
      revenueProtectedCents,
      depositsCollectedCents,
      noShowFeesCents,
      cancelFeesCents,
      byMonth,
      newClients30d,
      topServices: topServices.map(s => ({ name: svcMap.get(s.serviceId) ?? 'Unknown', count: s._count._all })),
      topStaff: topStaff.map(s => ({ name: stfMap.get(s.staffId) ?? 'Unknown', count: s._count._all })),
      topClients: clientsWithSpend,
    };
  }
}
