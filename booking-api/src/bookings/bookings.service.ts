import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { EventsGateway } from '../events/events.gateway';
import { AvailabilityService } from '../availability/availability.service';
import { CalendarSyncService } from '../calendar-sync/calendar-sync.service';
import { CreateAppointmentDto, CreateRecurringDto, PublicCreateAppointmentDto, RescheduleDto, StatusDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { signAppointmentToken } from '../common/util/appointment-token';
import { normalizePhone } from '../common/util/phone';
import { isPaidPlan } from '../common/util/plan-features';
import { Prisma } from '@prisma/client';
import { addMinutes, addWeeks, addMonths, differenceInMinutes } from 'date-fns';
import { randomUUID } from 'node:crypto';
import { formatInTimeZone } from 'date-fns-tz';
import { verifyPublicClientToken } from '../common/util/public-client-token';

type BookingServiceForValidation = {
  id: string;
  businessId?: string;
  durationMinutes: number;
  bufferBeforeMin?: number | null;
  bufferAfterMin?: number | null;
  capacity?: number | null;
  resourceId?: string | null;
};

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private payments: PaymentsService,
    private events: EventsGateway,
    private availability: AvailabilityService,
    private calendarSync: CalendarSyncService,
  ) {}

  async findAll(
    businessId: string,
    page = 1,
    limit = 50,
    user?: { id: string; role: string },
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.AppointmentWhereInput = { businessId };

    // Role separation: STAFF only ever see their own appointments. OWNER/ADMIN
    // see all. Enforced server-side so it can't be bypassed by calling the API
    // directly (the web/mobile clients also filter, but that is cosmetic).
    if (user?.role === 'STAFF') {
      const staff = await this.prisma.staff.findFirst({
        where: { userId: user.id, businessId },
        select: { id: true },
      });
      // No staff record for this user → match nothing rather than leak.
      where.staffId = staff?.id ?? '__no_staff__';
    }
    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: { client: true, service: true, staff: { include: { user: true } }, business: true, location: { select: { id: true, name: true } } },
        orderBy: { startsAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findAllInRange(
    businessId: string,
    from?: string,
    to?: string,
    user?: { id: string; role: string },
  ) {
    const where: Prisma.AppointmentWhereInput = { businessId };

    if (user?.role === 'STAFF') {
      const staff = await this.prisma.staff.findFirst({
        where: { userId: user.id, businessId },
        select: { id: true },
      });
      where.staffId = staff?.id ?? '__no_staff__';
    }

    if (from || to) {
      where.startsAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lt: new Date(to) } : {}),
      };
    }

    const data = await this.prisma.appointment.findMany({
      where,
      include: { client: true, service: true, staff: { include: { user: true } }, business: true, location: { select: { id: true, name: true } } },
      orderBy: { startsAt: 'asc' },
      take: 1000,
    });
    return { data, total: data.length };
  }

  async findOne(id: string, businessId?: string) {
    const apt = await this.prisma.appointment.findFirst({
      where: {
        id,
        ...(businessId ? { businessId } : {})
      },
      include: { client: true, service: true, staff: { include: { user: true } }, business: true, location: { select: { id: true, name: true } } },
    });
    if (!apt) throw new NotFoundException('Appointment not found');
    return apt;
  }

  async findOnePublic(id: string, manageToken: string) {
    const appointment = await this.findOne(id);
    return this.toPublicAppointment(appointment, manageToken);
  }

  async createPublic(businessId: string, dto: PublicCreateAppointmentDto) {
    const clientId = verifyPublicClientToken(dto.clientToken, businessId);
    if (!clientId) throw new ForbiddenException('Invalid or expired booking session');
    const { clientToken: _clientToken, ...fields } = dto;
    void _clientToken;
    const appointment = await this.create(businessId, { ...fields, clientId });
    return this.toPublicAppointment(appointment, appointment.manageToken);
  }

  toPublicAppointment(appointment: any, manageToken: string) {
    return {
      id: appointment.id,
      businessId: appointment.businessId,
      staffId: appointment.staffId,
      serviceId: appointment.serviceId,
      clientId: appointment.clientId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
      cancelReason: appointment.cancelReason,
      depositCents: appointment.depositCents,
      totalPriceCents: appointment.totalPriceCents,
      notes: appointment.notes,
      intakeAnswers: appointment.intakeAnswers,
      locationId: appointment.locationId,
      discountCents: appointment.discountCents,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
      manageToken,
      client: {
        id: appointment.client.id,
        name: appointment.client.name,
        email: appointment.client.email,
        phone: appointment.client.phone,
      },
      service: {
        id: appointment.service.id,
        name: appointment.service.name,
        description: appointment.service.description,
        durationMinutes: appointment.service.durationMinutes,
        priceCents: appointment.service.priceCents,
        priceType: appointment.service.priceType,
      },
      staff: {
        id: appointment.staff.id,
        bio: appointment.staff.bio,
        avatarUrl: appointment.staff.avatarUrl,
        user: { name: appointment.staff.user.name },
      },
      business: {
        id: appointment.business.id,
        name: appointment.business.name,
        slug: appointment.business.slug,
        timezone: appointment.business.timezone,
        address: appointment.business.address,
        phone: appointment.business.phone,
        logoUrl: appointment.business.logoUrl,
        currency: appointment.business.currency,
        cancellationWindowHours: appointment.business.cancellationWindowHours,
        cancellationWindowMinutes: appointment.business.cancellationWindowMinutes,
        cancellationPolicy: appointment.business.cancellationPolicy,
        allowClientReschedule: appointment.business.allowClientReschedule,
      },
      location: appointment.location ? { id: appointment.location.id, name: appointment.location.name } : null,
    };
  }

  // Providers with no explicit service assignments offer every service. This is
  // the owner-provider default for sole proprietors, while assigned staff remain
  // restricted to their selected services.
  private async hasExplicitServiceAssignments(staffId: string): Promise<boolean> {
    return (await this.prisma.staffService.count({ where: { staffId } })) > 0;
  }

  private maxAdvanceMs(business?: { maxAdvanceMinutes?: number | null; maxAdvanceDays?: number | null } | null) {
    const minutes = business?.maxAdvanceMinutes ?? ((business?.maxAdvanceDays ?? 365) * 24 * 60);
    return minutes * 60_000;
  }

  private cancellationWindowMinutes(business?: { cancellationWindowMinutes?: number | null; cancellationWindowHours?: number | null } | null) {
    return business?.cancellationWindowMinutes ?? ((business?.cancellationWindowHours ?? 0) * 60);
  }

  private cancellationCutoff(startsAt: Date, business?: { cancellationWindowMinutes?: number | null; cancellationWindowHours?: number | null } | null) {
    return new Date(startsAt.getTime() - this.cancellationWindowMinutes(business) * 60_000);
  }

  private formatPolicyMinutes(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /**
   * Creates an appointment with SERIALIZABLE isolation + SELECT FOR UPDATE
   * to guarantee exactly-once booking under concurrent requests.
   */
  async create(businessId: string, dto: CreateAppointmentDto, opts: { confirmed?: boolean; overrideConflicts?: boolean; recurringGroupId?: string } = {}) {
    const primaryService = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, businessId },
    });
    if (!primaryService) throw new NotFoundException('Service not found');
    if (primaryService.active === false) throw new BadRequestException('Service is not available');

    // A deactivated business accepts no new public bookings (owner/manual
    // bookings, which pass `confirmed`, are still allowed while paused).
    if (!opts.confirmed) {
      const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { suspended: true } });
      if (biz?.suspended) throw new BadRequestException('This business is not currently accepting online bookings');
    }

    // Tenant integrity: the staff and client must belong to THIS business, the
    // staff must be active, and actually offer the selected service. Otherwise a
    // crafted request could attach another business's staff/client to a booking.
    const staff = await this.prisma.staff.findFirst({ where: { id: dto.staffId, businessId, active: true } });
    if (!staff) throw new NotFoundException('Staff not found');
    const client = await this.prisma.client.findFirst({ where: { id: dto.clientId, businessId } });
    if (!client) throw new NotFoundException('Client not found');
    const staffHasExplicitAssignments = await this.hasExplicitServiceAssignments(dto.staffId);
    if (staffHasExplicitAssignments && !opts.overrideConflicts) {
      const offersService = await this.prisma.staffService.findFirst({ where: { staffId: dto.staffId, serviceId: dto.serviceId } });
      if (!offersService) {
        throw new BadRequestException('This staff member does not offer the selected service');
      }
    }

    // Sum durations of all selected services
    let totalDurationMinutes = primaryService.durationMinutes;
    let subtotalCents = primaryService.priceCents;
    const additionalServiceNames: string[] = [];
    let additionalServices: BookingServiceForValidation[] = [];
    if (dto.additionalServiceIds?.length) {
      const ids = [...new Set(dto.additionalServiceIds)];
      const extras = await this.prisma.service.findMany({
        where: { id: { in: ids }, businessId, active: true },
      });
      if (extras.length !== ids.length) {
        throw new BadRequestException('One or more selected services are unavailable');
      }
      // Every additional service must also be offered by providers that use
      // explicit service assignments. Owner/default providers offer all.
      const offered = staffHasExplicitAssignments && !opts.overrideConflicts
        ? await this.prisma.staffService.count({
            where: { staffId: dto.staffId, serviceId: { in: ids } },
          })
        : ids.length;
      if (offered !== ids.length) {
        throw new BadRequestException('This staff member does not offer one of the selected services');
      }
      totalDurationMinutes += extras.reduce((sum, s) => sum + s.durationMinutes, 0);
      subtotalCents += extras.reduce((sum, s) => sum + s.priceCents, 0);
      additionalServiceNames.push(...extras.map((s) => s.name));
      additionalServices = extras;
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = addMinutes(startsAt, totalDurationMinutes);

    // Booking-window policy. Owner/staff bookings (opts.confirmed) can override;
    // public self-service must respect the business's notice + advance limits.
    if (!opts.confirmed) {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        select: { minNoticeMinutes: true, maxAdvanceDays: true, maxAdvanceMinutes: true, timezone: true },
      });
      const now = Date.now();
      const minNoticeMs = (business?.minNoticeMinutes ?? 0) * 60_000;
      const maxAdvanceMs = this.maxAdvanceMs(business);
      if (startsAt.getTime() < now + minNoticeMs) {
        throw new BadRequestException('This time is too soon — please pick a later slot.');
      }
      if (startsAt.getTime() > now + maxAdvanceMs) {
        throw new BadRequestException('This time is too far in advance.');
      }
      await this.assertStartsAtAvailable(dto.staffId, dto.serviceId, startsAt, endsAt, business?.timezone ?? 'UTC');
    }

    // Append additional service names to notes for display
    const notesWithServices = [
      dto.notes,
      additionalServiceNames.length
        ? `Also includes: ${additionalServiceNames.join(', ')}`
        : null,
    ]
      .filter(Boolean)
      .join(' | ') || undefined;

    const runBooking = () =>
      this.prisma.$transaction(
        async (tx) => {
          let discountCents = 0;
          if (dto.promoCodeId) {
            // Serialize promo consumption with booking creation so maxUsages cannot
            // be exceeded by concurrent requests and the client cannot choose the
            // discount amount or attach another business's promotion.
            await tx.$queryRaw(Prisma.sql`
              SELECT id FROM "PromoCode" WHERE id = ${dto.promoCodeId} FOR UPDATE
            `);
            const promo = await tx.promoCode.findFirst({
              where: { id: dto.promoCodeId, businessId, active: true },
            });
            if (!promo) throw new BadRequestException('Invalid promo code');
            if (promo.expiresAt && promo.expiresAt < new Date()) {
              throw new BadRequestException('Promo code has expired');
            }
            if (promo.maxUsages !== null && promo.usageCount >= promo.maxUsages) {
              throw new BadRequestException('Promo code has reached its usage limit');
            }
            discountCents = promo.discountType === 'PERCENT'
              ? Math.min(subtotalCents, Math.round(subtotalCents * promo.discountValue / 100))
              : Math.min(subtotalCents, promo.discountValue);
            await tx.promoCode.update({
              where: { id: promo.id, businessId: promo.businessId },
              data: { usageCount: { increment: 1 } },
            });
          }

          if (!opts.overrideConflicts) {
            await this.assertBookableWindow(tx, {
              businessId,
              staffId: dto.staffId,
              service: primaryService,
              resourceIds: this.resourceIdsForServices([primaryService, ...additionalServices]),
              startsAt,
              endsAt,
            });
          }

          return tx.appointment.create({
            data: {
              businessId,
              staffId: dto.staffId,
              serviceId: dto.serviceId,
              clientId: dto.clientId,
              startsAt,
              endsAt,
              totalPriceCents: Math.max(0, subtotalCents - discountCents),
              notes: notesWithServices,
              // Owner/staff-initiated bookings skip the approval queue and are
              // confirmed immediately; public self-service stays PENDING.
              ...(opts.confirmed ? { status: 'CONFIRMED' as const } : {}),
              ...(opts.recurringGroupId ? { recurringGroupId: opts.recurringGroupId } : {}),
              ...(dto.intakeAnswers?.length ? { intakeAnswers: dto.intakeAnswers } : {}),
              // Multi-location: the appointment inherits its provider's location.
              ...(staff.locationId ? { locationId: staff.locationId } : {}),
              ...(dto.referralSource ? { referralSource: dto.referralSource } : {}),
              ...(dto.promoCodeId ? { promoCodeId: dto.promoCodeId, discountCents } : {}),
            },
            include: { client: true, service: true, staff: { include: { user: true } }, business: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    // When two bookings race for the same slot, neither sees an existing row to
    // lock, so both proceed and Postgres aborts the loser at COMMIT with a
    // write-conflict (P2034). Retry: the next attempt's in-transaction re-check
    // sees the now-committed row and throws a clean 409 instead of a 500.
    let appointment: Awaited<ReturnType<typeof runBooking>>;
    for (let attempt = 0; ; attempt++) {
      try {
        appointment = await runBooking();
        break;
      } catch (err) {
        if (err instanceof ConflictException) throw err;
        const isWriteConflict =
          err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';
        if (isWriteConflict && attempt < 2) continue;
        if (isWriteConflict) {
          throw new ConflictException('This time slot is no longer available');
        }
        throw err;
      }
    }

    await this.logAction('APPOINTMENT', appointment.id, 'CREATE', {
      startsAt: appointment.startsAt,
      confirmed: !!opts.confirmed,
      overrideConflicts: !!opts.overrideConflicts,
    });

    this.events.emitBookingUpdate(businessId, {
      type: 'CREATE',
      appointmentId: appointment.id,
      status: appointment.status,
    });

    if (opts.confirmed) {
      // Owner/staff booking: confirm immediately, send the real confirmation to
      // the client and schedule reminders. No pending notice, no owner alert.
      await this.notifications.scheduleReminders(appointment);
      void this.calendarSync.syncWithRetry(appointment.id); // best-effort, fire-and-forget
    } else {
      // Public self-service: notify client it's PENDING approval; alert owner to act.
      await Promise.allSettled([
        this.notifications.sendPendingNotification(appointment),
        this.notifications.sendAdminBookingAlert(appointment.id),
      ]);
      void this.calendarSync.syncWithRetry(appointment.id); // keep connected calendars blocked even while pending
    }

    // Manage token so the confirmation screen can link straight to the manage page.
    return { ...appointment, manageToken: signAppointmentToken(appointment.id) };
  }

  // Owner-initiated recurring series. Creates `count` occurrences spaced by the
  // chosen frequency, all sharing a recurringGroupId. The first occurrence must
  // succeed; later occurrences that hit a conflict are skipped and reported so the
  // owner can rebook those individually.
  async createRecurring(businessId: string, dto: CreateRecurringDto, opts: { confirmed?: boolean } = {}) {
    const { frequency, count } = dto;
    const base: CreateAppointmentDto = {
      staffId: dto.staffId, serviceId: dto.serviceId, additionalServiceIds: dto.additionalServiceIds,
      clientId: dto.clientId, startsAt: dto.startsAt, notes: dto.notes, allowOverride: dto.allowOverride,
    };
    const baseStart = new Date(dto.startsAt);
    const groupId = randomUUID();
    const created: Array<{ id: string; startsAt: Date }> = [];
    const skipped: string[] = [];

    for (let i = 0; i < count; i++) {
      const weekInterval = frequency === 'BIWEEKLY' ? 2 : frequency === 'THREE_WEEKS' ? 3 : frequency === 'EIGHT_WEEKS' ? 8 : 1;
      const occStart = frequency === 'MONTHLY'
        ? addMonths(baseStart, i)
        : addWeeks(baseStart, i * weekInterval);
      try {
        const apt = await this.create(
          businessId,
          { ...base, startsAt: occStart.toISOString() },
          { confirmed: opts.confirmed, overrideConflicts: base.allowOverride === true, recurringGroupId: groupId },
        );
        created.push({ id: apt.id, startsAt: apt.startsAt });
      } catch (err) {
        if (i === 0) throw err; // a series must start with a valid first booking
        skipped.push(occStart.toISOString());
      }
    }

    return { groupId, created, skipped };
  }

  async confirm(id: string, businessId?: string, userId?: string) {
    const apt = await this.findOne(id, businessId);
    if (isPaidPlan(apt.business.plan) && apt.business.requireDeposit && apt.status === 'PENDING') {
      const paidDeposit = await this.prisma.payment.findFirst({
        where: {
          appointmentId: id,
          businessId: apt.businessId,
          kind: 'DEPOSIT',
          status: 'SUCCEEDED',
        },
      });
      if (!paidDeposit) {
        throw new BadRequestException('This booking requires a paid deposit before it can be confirmed.');
      }
    }
    const updated = await this.prisma.appointment.update({
      where: { id, businessId: apt.businessId },
      data: { status: 'CONFIRMED' },
      include: { client: true, service: true, business: true },
    });
    await this.logAction('APPOINTMENT', id, 'UPDATE_STATUS', {
      fromStatus: apt.status,
      status: 'CONFIRMED',
    }, userId);

    this.events.emitBookingUpdate(updated.businessId, {
      type: 'UPDATE_STATUS',
      appointmentId: id,
      status: 'CONFIRMED',
    });

    await this.notifications.scheduleReminders(updated);
    void this.calendarSync.syncWithRetry(updated.id); // push to Google Calendar
    return updated;
  }

  async reschedule(
    id: string,
    dto: RescheduleDto,
    businessId?: string,
    opts: { byClient?: boolean; userId?: string } = {},
  ) {
    const existing = await this.findOne(id, businessId);
    const service = await this.prisma.service.findFirstOrThrow({
      where: { id: existing.serviceId, businessId: existing.businessId },
    });
    if (service.active === false) throw new BadRequestException('Service is not available');

    const startsAt = new Date(dto.startsAt);
    // Preserve the original appointment length (which may span multiple services).
    // Recomputing from service.durationMinutes alone would truncate any add-on
    // services that were included at booking time.
    const originalDurationMinutes = differenceInMinutes(existing.endsAt, existing.startsAt);
    const endsAt = addMinutes(startsAt, Math.max(originalDurationMinutes, service.durationMinutes));

    // Re-apply the same integrity + policy checks as creation — a reschedule must
    // not slip a booking into a state the business wouldn't otherwise allow.
    const biz = existing.business;
    const staff = await this.prisma.staff.findFirst({
      where: { id: existing.staffId, businessId: existing.businessId, active: true },
    });
    if (!staff) throw new BadRequestException('This staff member is no longer available');
    const hasExplicitAssignments = await this.hasExplicitServiceAssignments(existing.staffId);
    if (hasExplicitAssignments) {
      const offersService = await this.prisma.staffService.findFirst({
        where: { staffId: existing.staffId, serviceId: existing.serviceId },
      });
      if (!offersService) throw new BadRequestException('This staff member no longer offers the service');
    }

    if (opts.byClient) {
      if (biz && !biz.allowClientReschedule) {
        throw new ForbiddenException('Online rescheduling is disabled — please contact the business.');
      }
      const now = Date.now();
      const cutoff = biz && this.cancellationCutoff(existing.startsAt, biz);
      if (cutoff && now >= cutoff.getTime()) {
        const windowLabel = this.formatPolicyMinutes(this.cancellationWindowMinutes(biz));
        throw new ForbiddenException({
          code: 'TOO_LATE_TO_RESCHEDULE',
          message: `It's past the ${windowLabel} change window. Please contact ${biz.name} to reschedule.`,
        });
      }
      const minNoticeMs = (biz?.minNoticeMinutes ?? 0) * 60_000;
      const maxAdvanceMs = this.maxAdvanceMs(biz);
      if (startsAt.getTime() < now + minNoticeMs) throw new BadRequestException('This time is too soon — please pick a later slot.');
      if (startsAt.getTime() > now + maxAdvanceMs) throw new BadRequestException('This time is too far in advance.');
      await this.assertStartsAtAvailable(existing.staffId, existing.serviceId, startsAt, endsAt, biz?.timezone ?? 'UTC');
    }

    const runReschedule = () =>
      this.prisma.$transaction(
        async (tx) => {
          await this.assertBookableWindow(tx, {
            businessId: existing.businessId,
            staffId: existing.staffId,
            service,
            resourceIds: this.resourceIdsForServices([service]),
            startsAt,
            endsAt,
            excludeAppointmentId: id,
          });

          return tx.appointment.update({
            where: { id, businessId: existing.businessId },
            // A client-initiated reschedule goes back to PENDING for re-approval.
            // An owner/staff reschedule keeps the current status (a CONFIRMED
            // booking stays CONFIRMED) — moving a time shouldn't un-confirm it.
            data: { startsAt, endsAt, ...(opts.byClient ? { status: 'PENDING' as const } : {}) },
            include: { client: true, service: true, business: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    // Same write-conflict (P2034) retry as create() — see note there.
    let updated: Awaited<ReturnType<typeof runReschedule>>;
    for (let attempt = 0; ; attempt++) {
      try {
        updated = await runReschedule();
        break;
      } catch (err) {
        if (err instanceof ConflictException) throw err;
        const isWriteConflict =
          err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';
        if (isWriteConflict && attempt < 2) continue;
        if (isWriteConflict) throw new ConflictException('New time slot is not available');
        throw err;
      }
    }

    await this.notifications.cancelReminders(id);
    await this.notifications.sendReschedule(updated);
    // Re-arm reminders against the new time when the booking remains CONFIRMED
    // (owner reschedule). Client reschedules drop to PENDING and get reminders
    // when the owner re-confirms, so we don't double-schedule here.
    if (updated.status === 'CONFIRMED') await this.notifications.scheduleReminders(updated);
    void this.calendarSync.syncWithRetry(id); // update the Google event time
    await this.logAction('APPOINTMENT', id, 'RESCHEDULE', {
      fromStartsAt: existing.startsAt,
      toStartsAt: startsAt,
      fromStatus: existing.status,
      status: updated.status,
      byClient: !!opts.byClient,
    }, opts.userId);

    this.events.emitBookingUpdate(updated.businessId, {
      type: 'RESCHEDULE',
      appointmentId: id,
      status: updated.status,
    });

    return updated;
  }

  // Allowed status transitions. Any move not listed is rejected so COMPLETED /
  // NO_SHOW / CANCELLED appointments can't be reversed via the status endpoint.
  private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
    PENDING:   ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
    COMPLETED: [],
    NO_SHOW:   [],
    CANCELLED: [],
  };

  async updateStatus(id: string, dto: StatusDto, businessId?: string, byStaff = false, userId?: string) {
    const existing = await this.findOne(id, businessId);
    const allowed = BookingsService.VALID_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Cannot transition appointment from ${existing.status} to ${dto.status}`);
    }

    // Mirror the deposit check from confirm() so the status endpoint can't be
    // used to bypass the deposit requirement by sending status=CONFIRMED directly.
    if (dto.status === 'CONFIRMED') {
      const biz = existing.business;
      if (isPaidPlan(biz.plan) && biz.requireDeposit && existing.status === 'PENDING') {
        const paidDeposit = await this.prisma.payment.findFirst({
          where: {
            appointmentId: id,
            businessId: existing.businessId,
            kind: 'DEPOSIT',
            status: 'SUCCEEDED',
          },
        });
        if (!paidDeposit) {
          throw new BadRequestException('This booking requires a paid deposit before it can be confirmed.');
        }
      }
    }

    // Strict cancellation-window enforcement. A client (byStaff=false) may only
    // self-cancel BEFORE the business's cancellation window. Once inside it, the
    // online cancel is refused — the client is told to contact the business, and
    // the owner is notified to decide whether to cancel and/or charge. Owners and
    // staff (byStaff=true) can always cancel.
    if (dto.status === 'CANCELLED' && !byStaff) {
      const biz = existing.business;
      const cutoff = biz && this.cancellationCutoff(existing.startsAt, biz);
      if (cutoff && new Date() > cutoff) {
        const windowLabel = this.formatPolicyMinutes(this.cancellationWindowMinutes(biz));
        await this.notifications.sendLateCancellationRequest(existing).catch(() => {});
        throw new ForbiddenException({
          code: 'TOO_LATE_TO_CANCEL',
          message: `It's past the ${windowLabel} cancellation window. Please contact ${biz!.name} to cancel — we've let them know you'd like to.`,
        });
      }
    }

    const updated = await this.prisma.appointment.update({
      where: { id, businessId: existing.businessId },
      data: {
        status: dto.status,
        ...(dto.cancelReason ? { cancelReason: dto.cancelReason } : {}),
      },
      include: { client: true, service: true, business: true },
    });

    let cancelFee: { charged: boolean; feeCents: number; reason?: string } | undefined;
    const auditChanges: Record<string, unknown> = {
      fromStatus: existing.status,
      status: dto.status,
    };

    if (dto.status === 'CANCELLED') {
      await this.notifications.cancelReminders(id);
      void this.calendarSync.removeWithRetry(id); // remove the Google event

      // Late-cancellation fee. PAID plans only; client-initiated cancels only
      // (byStaff=false — an owner/staff cancel never charges the client). It's a
      // "late" cancel when we're already inside the cancellation window. Free tier
      // and early cancels are always free. Best-effort: never blocks the cancel.
      const biz = updated.business;
      const cancellationTiming =
        biz && new Date() > this.cancellationCutoff(updated.startsAt, biz)
          ? 'late'
          : 'early';
      auditChanges.cancelledBy = byStaff ? 'staff' : 'client';
      auditChanges.cancellationTiming = cancellationTiming;
      auditChanges.cancellationWindowHours = biz?.cancellationWindowHours ?? null;
      auditChanges.cancellationWindowMinutes = this.cancellationWindowMinutes(biz);

      // Cancellation fee: charged only when the owner/staff explicitly opts in
      // while cancelling (e.g. enforcing the policy after a client cancelled late
      // — late client self-cancels are blocked above, so the owner does it). The
      // payments service owns eligibility (Pro + a configured fee + a card on
      // file) and is best-effort: it never throws, so the cancel always succeeds.
      // A client self-cancel never charges.
      if (byStaff && dto.chargeCancellationFee) {
        cancelFee = await this.payments.chargeCancellationFee(id, updated.businessId);
        auditChanges.cancelFee = cancelFee;
      }

      if (byStaff) {
        await this.notifications.sendStaffCancellation(updated);
      } else {
        await this.notifications.sendCancellation(updated);
      }
      await this.notifyWaitlist(updated);
    }

    await this.logAction('APPOINTMENT', id, 'UPDATE_STATUS', auditChanges, userId);

    this.events.emitBookingUpdate(updated.businessId, {
      type: 'UPDATE_STATUS',
      appointmentId: id,
      status: dto.status,
    });

    if (dto.status === 'COMPLETED') {
      // Post-visit review request.
      const full = await this.findOne(id, businessId);
      await this.notifications.sendReviewRequest(full);
      const matchingPolicies = await this.prisma.followUpPolicy.findMany({
        where: {
          businessId: updated.businessId,
          enabled: true,
          trigger: 'COMPLETED',
          OR: [{ serviceId: updated.serviceId }, { serviceId: null }],
        },
      });
      const servicePolicies = matchingPolicies.filter((policy) => policy.serviceId === updated.serviceId);
      const policies = servicePolicies.length > 0
        ? servicePolicies
        : matchingPolicies.filter((policy) => policy.serviceId === null);
      for (const policy of policies) {
        await this.prisma.serviceDue.create({
          data: {
            businessId: updated.businessId,
            clientId: updated.clientId,
            serviceId: updated.serviceId,
            policyId: policy.id,
            dueAt: new Date(Date.now() + policy.delayDays * 86_400_000),
            messageSubject: policy.subject,
            messageBody: policy.body,
          },
        });
      }
    }

    // Policy due: a no-show was just recorded and a fee is configured but wasn't
    // auto-collected here — prompt the owner in their dashboard to charge it.
    if (dto.status === 'NO_SHOW' && !cancelFee?.charged && updated.business.noShowFeeCents > 0) {
      await this.promptOwnersToCharge(updated.businessId, id, 'NO_SHOW', updated.client.name, updated.business.noShowFeeCents);
    }

    return { ...updated, cancelFee };
  }

  // In-app dashboard prompt to the owner(s) that a chargeable policy is due
  // (no-show / late cancellation). Best-effort — never blocks the action.
  private async promptOwnersToCharge(
    businessId: string,
    appointmentId: string,
    kind: 'NO_SHOW' | 'LATE_CANCEL',
    clientName: string,
    feeCents: number,
  ) {
    try {
      const owners = await this.prisma.user.findMany({ where: { businessId, role: 'OWNER' }, select: { id: true } });
      if (!owners.length) return;
      const fee = `$${(feeCents / 100).toFixed(2)}`;
      const title = kind === 'NO_SHOW' ? `Charge no-show fee?` : `Charge late-cancellation fee?`;
      const body = kind === 'NO_SHOW'
        ? `${clientName} didn't show up. Your policy allows a ${fee} no-show fee — open the appointment to charge it.`
        : `${clientName} cancelled inside your window. Your policy allows a ${fee} late-cancellation fee — open the appointment to charge it.`;
      await this.prisma.notification.createMany({
        data: owners.map((o) => ({ userId: o.id, kind: 'PAYMENT' as const, title, body, linkUrl: '/dashboard/appointments' })),
      });
    } catch { /* never block on the prompt */ }
  }

  async requestLateCancellation(id: string, cancelReason?: string) {
    const existing = await this.findOne(id);
    if (!['PENDING', 'CONFIRMED'].includes(existing.status)) {
      throw new BadRequestException('Only pending or confirmed appointments can request cancellation');
    }
    const cutoff = this.cancellationCutoff(existing.startsAt, existing.business);
    if (new Date() <= cutoff) {
      throw new BadRequestException('This appointment is still outside the cancellation window and can be cancelled online.');
    }

    await this.notifications.sendLateCancellationRequest({
      ...existing,
      ...(cancelReason ? { cancelReason } : {}),
    }).catch(() => {});

    // Dashboard prompt to the owner when a late-cancel fee is configured.
    if (existing.business.cancellationFeeCents > 0) {
      await this.promptOwnersToCharge(existing.businessId, id, 'LATE_CANCEL', existing.client.name, existing.business.cancellationFeeCents);
    }

    await this.logAction('APPOINTMENT', id, 'LATE_CANCEL_REQUEST', {
      status: existing.status,
      cancellationWindowHours: existing.business.cancellationWindowHours,
      cancellationWindowMinutes: this.cancellationWindowMinutes(existing.business),
    });
    const windowLabel = this.formatPolicyMinutes(this.cancellationWindowMinutes(existing.business));

    return {
      ok: true,
      code: 'LATE_CANCEL_REQUESTED',
      message: `It's past the ${windowLabel} cancellation window. Please contact ${existing.business.name} to cancel — we've let them know you'd like to.`,
    };
  }

  async updateDetails(id: string, dto: UpdateAppointmentDto, businessId: string, userId?: string) {
    const existing = await this.findOne(id, businessId);
    let startsAt = existing.startsAt;
    let endsAt = existing.endsAt;
    let timeChanged = false;

    if (dto.startsAt) {
      startsAt = new Date(dto.startsAt);
      // Preserve the original appointment length so multi-service duration is kept.
      const originalDurationMinutes = differenceInMinutes(existing.endsAt, existing.startsAt);
      endsAt = addMinutes(startsAt, originalDurationMinutes);
      timeChanged = startsAt.getTime() !== existing.startsAt.getTime();
    }

    const normalizedClientPhone =
      dto.clientPhone !== undefined && dto.clientPhone
        ? normalizePhone(dto.clientPhone)
        : undefined;
    if (dto.clientPhone && !normalizedClientPhone) {
      throw new BadRequestException('Enter a valid phone number, e.g. +1 555 123 4567');
    }

    const updateData = {
      ...(dto.startsAt ? { startsAt, endsAt } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
      ...(dto.clientName || dto.clientEmail || dto.clientPhone !== undefined
        ? {
            client: {
              update: {
                ...(dto.clientName ? { name: dto.clientName } : {}),
                ...(dto.clientEmail ? { email: dto.clientEmail } : {}),
                ...(dto.clientPhone !== undefined ? { phone: normalizedClientPhone ?? null } : {}),
              },
            },
          }
        : {}),
    };

    const include = { client: true, service: true, staff: { include: { user: true } }, business: true } as const;

    // Time change: acquire row lock to serialise against concurrent reschedules.
    // Same pattern as reschedule() — Serializable isolation + SELECT FOR UPDATE
    // + P2034 retry prevents two concurrent requests from double-booking a slot.
    const runUpdate = () =>
      this.prisma.$transaction(
        async (tx) => {
          if (timeChanged) {
            await this.assertBookableWindow(tx, {
              businessId: existing.businessId,
              staffId: existing.staffId,
              service: existing.service,
              resourceIds: this.resourceIdsForServices([existing.service]),
              startsAt,
              endsAt,
              excludeAppointmentId: id,
            });
          }

          return tx.appointment.update({ where: { id, businessId: existing.businessId }, data: updateData, include });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    let updated!: Awaited<ReturnType<typeof runUpdate>>;

    if (timeChanged) {
      for (let attempt = 0; ; attempt++) {
        try {
          updated = await runUpdate();
          break;
        } catch (err) {
          if (err instanceof ConflictException) throw err;
          const isWriteConflict =
            err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';
          if (!isWriteConflict || attempt >= 2) throw err;
        }
      }
    } else {
      updated = await this.prisma.appointment.update({ where: { id, businessId: existing.businessId }, data: updateData, include });
    }

    if (timeChanged) await this.notifications.cancelReminders(id);
    if (dto.notifyClient) {
      if (timeChanged) await this.notifications.sendReschedule(updated);
      else await this.notifications.sendConfirmation(updated);
    }

    await this.logAction('APPOINTMENT', id, 'UPDATE_DETAILS', {
      fromStartsAt: existing.startsAt,
      toStartsAt: startsAt,
      clientUpdated: !!(dto.clientName || dto.clientEmail || dto.clientPhone !== undefined),
      notesUpdated: dto.notes !== undefined,
      notifiedClient: !!dto.notifyClient,
    }, userId);

    this.events.emitBookingUpdate(updated.businessId, {
      type: 'UPDATE_DETAILS',
      appointmentId: id,
      status: updated.status,
    });

    return updated;
  }

  // Auto-fill: when a slot opens (cancellation), notify the oldest waiting
  // entry for this exact slot first. Day-level and general service waitlist
  // entries still work as a fallback.
  private async notifyWaitlist(appointment: { businessId: string; serviceId: string; staffId: string; startsAt: Date; endsAt: Date }) {
    const dayStart = new Date(appointment.startsAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const baseWhere = { businessId: appointment.businessId, status: 'WAITING' as const };
    const candidates = [
      { serviceId: appointment.serviceId, staffId: appointment.staffId, desiredDate: appointment.startsAt },
      { serviceId: appointment.serviceId, staffId: null, desiredDate: appointment.startsAt },
      { serviceId: appointment.serviceId, staffId: appointment.staffId, desiredDate: { gte: dayStart, lt: dayEnd } },
      { serviceId: appointment.serviceId, staffId: null, desiredDate: { gte: dayStart, lt: dayEnd } },
      { serviceId: appointment.serviceId, desiredDate: null },
      { serviceId: null },
    ];
    let entry: { id: string } | null = null;
    for (const where of candidates) {
      entry = await this.prisma.waitlistEntry.findFirst({
        where: { ...baseWhere, ...where },
        orderBy: { createdAt: 'asc' },
      });
      if (entry) break;
    }
    if (!entry) return;
    await this.prisma.waitlistEntry.update({ where: { id: entry.id, businessId: appointment.businessId }, data: { status: 'NOTIFIED' } });
    await this.notifications.notifyWaitlistOpening(entry.id);
  }

  private resourceIdsForServices(services: BookingServiceForValidation[]) {
    return [...new Set(services.map((s) => s.resourceId).filter((id): id is string => !!id))];
  }

  private occupiedWindow(startsAt: Date, endsAt: Date, service: BookingServiceForValidation) {
    return {
      start: addMinutes(startsAt, -(service.bufferBeforeMin ?? 0)),
      end: addMinutes(endsAt, service.bufferAfterMin ?? 0),
    };
  }

  private overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
    return a.start < b.end && a.end > b.start;
  }

  private async lockNearbyAppointments(
    tx: any,
    args: { businessId: string; staffId: string; occupiedStart: Date; occupiedEnd: Date; excludeAppointmentId?: string },
  ) {
    const lockStart = addMinutes(args.occupiedStart, -480);
    const lockEnd = addMinutes(args.occupiedEnd, 480);
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM "Appointment"
      WHERE "staffId" = ${args.staffId}
        AND "businessId" = ${args.businessId}
        AND status IN ('CONFIRMED', 'PENDING')
        ${args.excludeAppointmentId ? Prisma.sql`AND id != ${args.excludeAppointmentId}` : Prisma.empty}
        AND "startsAt" < ${lockEnd}
        AND "endsAt" > ${lockStart}
      FOR UPDATE
    `);
  }

  private async lockNearbyResourceAppointments(
    tx: any,
    args: { businessId: string; resourceIds: string[]; occupiedStart: Date; occupiedEnd: Date; excludeAppointmentId?: string },
  ) {
    if (!args.resourceIds.length) return;
    const lockStart = addMinutes(args.occupiedStart, -480);
    const lockEnd = addMinutes(args.occupiedEnd, 480);
    await tx.$queryRaw(Prisma.sql`
      SELECT a.id FROM "Appointment" a
      JOIN "Service" s ON s.id = a."serviceId"
      WHERE a."businessId" = ${args.businessId}
        AND a.status IN ('CONFIRMED', 'PENDING')
        ${args.excludeAppointmentId ? Prisma.sql`AND a.id != ${args.excludeAppointmentId}` : Prisma.empty}
        AND s."resourceId" IN (${Prisma.join(args.resourceIds)})
        AND a."startsAt" < ${lockEnd}
        AND a."endsAt" > ${lockStart}
      FOR UPDATE
    `);
  }

  private async assertBookableWindow(
    tx: any,
    args: {
      businessId: string;
      staffId: string;
      service: BookingServiceForValidation;
      resourceIds: string[];
      startsAt: Date;
      endsAt: Date;
      excludeAppointmentId?: string;
    },
  ) {
    const occupied = this.occupiedWindow(args.startsAt, args.endsAt, args.service);
    const lockStart = addMinutes(occupied.start, -480);
    const lockEnd = addMinutes(occupied.end, 480);

    await this.lockNearbyAppointments(tx, {
      businessId: args.businessId,
      staffId: args.staffId,
      occupiedStart: occupied.start,
      occupiedEnd: occupied.end,
      excludeAppointmentId: args.excludeAppointmentId,
    });
    await this.lockNearbyResourceAppointments(tx, {
      businessId: args.businessId,
      resourceIds: args.resourceIds,
      occupiedStart: occupied.start,
      occupiedEnd: occupied.end,
      excludeAppointmentId: args.excludeAppointmentId,
    });

    const business = await tx.business.findUnique({
      where: { id: args.businessId },
      select: { timezone: true },
    });
    const timezone = business?.timezone ?? 'UTC';
    const dayOfWeek = Number(formatInTimeZone(args.startsAt, timezone, 'i')) % 7;
    const localStartDay = formatInTimeZone(args.startsAt, timezone, 'yyyy-MM-dd');
    const localEndDay = formatInTimeZone(args.endsAt, timezone, 'yyyy-MM-dd');
    if (localStartDay !== localEndDay) {
      throw new BadRequestException('This appointment must fit within one business day.');
    }

    const [rules, bizHours] = await Promise.all([
      tx.availabilityRule.findMany({ where: { staffId: args.staffId, dayOfWeek } }),
      tx.businessHours.findMany({ where: { businessId: args.businessId, dayOfWeek } }),
    ]);
    const effectiveRules = rules.length
      ? rules
      : bizHours.length
        ? bizHours
        : [{ startTime: '09:00', endTime: '17:00' }];
    const occupiedLocalStart = formatInTimeZone(occupied.start, timezone, 'HH:mm');
    const occupiedLocalEnd = formatInTimeZone(occupied.end, timezone, 'HH:mm');
    const fitsRule = effectiveRules.some((rule: { startTime: string; endTime: string }) =>
      occupiedLocalStart >= rule.startTime && occupiedLocalEnd <= rule.endTime,
    );
    if (!fitsRule) {
      throw new BadRequestException('This appointment is outside the available calendar window.');
    }

    const [timeOff, closure] = await Promise.all([
      tx.timeOff.findFirst({
        where: { staffId: args.staffId, startsAt: { lt: occupied.end }, endsAt: { gt: occupied.start } },
      }),
      tx.businessClosure.findFirst({
        where: { businessId: args.businessId, startsAt: { lt: occupied.end }, endsAt: { gt: occupied.start } },
      }),
    ]);
    if (timeOff) throw new BadRequestException('This time overlaps staff time off.');
    if (closure) throw new BadRequestException('This time overlaps a business closure.');

    const nearby = await tx.appointment.findMany({
      where: {
        businessId: args.businessId,
        staffId: args.staffId,
        status: { in: ['CONFIRMED', 'PENDING'] },
        ...(args.excludeAppointmentId ? { id: { not: args.excludeAppointmentId } } : {}),
        startsAt: { lt: lockEnd },
        endsAt: { gt: lockStart },
      },
      select: {
        id: true,
        serviceId: true,
        startsAt: true,
        endsAt: true,
        service: { select: { bufferBeforeMin: true, bufferAfterMin: true } },
      },
    });

    const overlapping = nearby.filter((apt: any) => this.overlaps(occupied, this.occupiedWindow(apt.startsAt, apt.endsAt, {
      id: apt.serviceId,
      durationMinutes: differenceInMinutes(apt.endsAt, apt.startsAt),
      bufferBeforeMin: apt.service?.bufferBeforeMin ?? 0,
      bufferAfterMin: apt.service?.bufferAfterMin ?? 0,
    })));
    const sameInstance = overlapping.filter((apt: any) => apt.serviceId === args.service.id && +apt.startsAt === +args.startsAt);
    if (overlapping.length > sameInstance.length) {
      throw new ConflictException('This time slot is no longer available');
    }
    if (sameInstance.length >= Math.max(1, args.service.capacity ?? 1)) {
      throw new ConflictException('This class is full');
    }

    if (args.resourceIds.length) {
      const resourceNearby = await tx.appointment.findMany({
        where: {
          businessId: args.businessId,
          status: { in: ['CONFIRMED', 'PENDING'] },
          ...(args.excludeAppointmentId ? { id: { not: args.excludeAppointmentId } } : {}),
          startsAt: { lt: lockEnd },
          endsAt: { gt: lockStart },
          service: { resourceId: { in: args.resourceIds } },
          NOT: { serviceId: args.service.id, startsAt: args.startsAt },
        },
        select: {
          id: true,
          serviceId: true,
          startsAt: true,
          endsAt: true,
          service: { select: { bufferBeforeMin: true, bufferAfterMin: true, resourceId: true } },
        },
      });
      const resourceBusy = resourceNearby.some((apt: any) => this.overlaps(occupied, this.occupiedWindow(apt.startsAt, apt.endsAt, {
        id: apt.serviceId,
        durationMinutes: differenceInMinutes(apt.endsAt, apt.startsAt),
        bufferBeforeMin: apt.service?.bufferBeforeMin ?? 0,
        bufferAfterMin: apt.service?.bufferAfterMin ?? 0,
        resourceId: apt.service?.resourceId ?? null,
      })));
      if (resourceBusy) {
        throw new ConflictException('The room or resource for this service is already booked at this time');
      }
    }
  }

  private async assertStartsAtAvailable(staffId: string, serviceId: string, startsAt: Date, endsAt: Date, timezone: string) {
    const day = formatInTimeZone(startsAt, timezone, 'yyyy-MM-dd');
    const slots = await this.availability.getAvailableSlots({
      staffId,
      serviceId,
      startDate: day,
      endDate: day,
      timezone,
    });
    if (!slots.some((slot) => slot.startsAt.getTime() === startsAt.getTime())) {
      throw new BadRequestException('This time is outside the business availability. Please choose another slot.');
    }
    const localStartDay = formatInTimeZone(startsAt, timezone, 'yyyy-MM-dd');
    const localEndDay = formatInTimeZone(endsAt, timezone, 'yyyy-MM-dd');
    if (localStartDay !== localEndDay) {
      throw new BadRequestException('This appointment must fit within one business day.');
    }

    const dayOfWeek = Number(formatInTimeZone(startsAt, timezone, 'i')) % 7;
    const localStart = formatInTimeZone(startsAt, timezone, 'HH:mm');
    const localEnd = formatInTimeZone(endsAt, timezone, 'HH:mm');
    const staff = await this.prisma.staff.findFirst({ where: { id: staffId }, select: { businessId: true } });
    const [rules, bizHours] = await Promise.all([
      this.prisma.availabilityRule.findMany({ where: { staffId, dayOfWeek } }),
      staff?.businessId && this.prisma.businessHours?.findMany
        ? this.prisma.businessHours.findMany({ where: { businessId: staff.businessId, dayOfWeek } })
        : Promise.resolve([]),
    ]);
    const effectiveRules = rules.length ? rules : bizHours.length ? bizHours : [{ startTime: '09:00', endTime: '17:00' }];
    const fitsRule = effectiveRules.some((rule) => localStart >= rule.startTime && localEnd <= rule.endTime);
    if (!fitsRule) {
      throw new BadRequestException('This appointment is longer than the available calendar window.');
    }

    const timeOff = await this.prisma.timeOff.findFirst({
      where: { staffId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    });
    if (timeOff) {
      throw new BadRequestException('This time overlaps staff time off.');
    }
  }

  private async logAction(entityType: string, entityId: string, action: string, changes?: any, userId?: string) {
    try {
      await this.prisma.auditLog.create({
        data: { entityType, entityId, action, changes, userId },
      });
    } catch (e) {
      console.error('[AuditLog Error]', e);
    }
  }
}
