import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, PlanTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { deleteUploadByUrl } from '../uploads/upload-cleanup';
import { addMonths } from 'date-fns';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class VerificationService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async submit(businessId: string, input: {
    legalName: string;
    address: string;
    phone: string;
    governmentIdUrl: string;
    registrationDocUrl: string;
  }) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { verificationStatus: true, verificationDocUrl: true, verificationGovernmentIdUrl: true },
    });
    if (!biz) throw new NotFoundException('Business not found');
    if (biz.verificationStatus === 'VERIFIED') {
      throw new BadRequestException('This business is already verified.');
    }
    const result = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        verificationStatus: 'PENDING',
        verificationLegalName: input.legalName.trim(),
        verificationAddress: input.address.trim(),
        verificationPhone: input.phone.trim(),
        verificationGovernmentIdUrl: input.governmentIdUrl,
        verificationDocUrl: input.registrationDocUrl,
        verificationNote: null,
        verificationSubmittedAt: new Date(),
      },
      select: { verificationStatus: true, verificationSubmittedAt: true },
    });
    if (biz.verificationDocUrl && biz.verificationDocUrl !== input.registrationDocUrl) {
      await deleteUploadByUrl(this.prisma, biz.verificationDocUrl);
    }
    if (biz.verificationGovernmentIdUrl && biz.verificationGovernmentIdUrl !== input.governmentIdUrl) {
      await deleteUploadByUrl(this.prisma, biz.verificationGovernmentIdUrl);
    }
    return result;
  }

  async status(businessId: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        verificationStatus: true,
        verificationDocUrl: true,
        verificationGovernmentIdUrl: true,
        verificationLegalName: true,
        verificationAddress: true,
        verificationPhone: true,
        verificationNote: true,
        verificationSubmittedAt: true,
        verifiedAt: true,
      },
    });
    if (!biz) throw new NotFoundException('Business not found');
    return biz;
  }

  // ── Admin review ──────────────────────────────────────────────────────────
  async listPending() {
    return this.prisma.business.findMany({
      where: { verificationStatus: 'PENDING' },
      orderBy: { verificationSubmittedAt: 'asc' },
      select: {
        id: true, name: true, email: true, slug: true,
        verificationDocUrl: true, verificationGovernmentIdUrl: true,
        verificationLegalName: true, verificationAddress: true, verificationPhone: true,
        verificationSubmittedAt: true,
      },
    });
  }

  // Businesses flagged at signup as a likely duplicate (same name + phone) and
  // not yet reviewed — plus the business they appear to duplicate, for context.
  async listFlaggedDuplicates() {
    const flagged = await this.prisma.business.findMany({
      where: { suspectedDuplicateOfId: { not: null }, duplicateReviewedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, phone: true, slug: true,
        createdAt: true, verificationNote: true, suspectedDuplicateOfId: true,
      },
    });
    const targetIds = [...new Set(flagged.map((b) => b.suspectedDuplicateOfId).filter((v): v is string => !!v))];
    const targets = targetIds.length
      ? await this.prisma.business.findMany({ where: { id: { in: targetIds } }, select: { id: true, name: true, email: true, phone: true, createdAt: true } })
      : [];
    const byId = new Map(targets.map((t) => [t.id, t]));
    return flagged.map((b) => ({ ...b, duplicateOf: b.suspectedDuplicateOfId ? byId.get(b.suspectedDuplicateOfId) ?? null : null }));
  }

  // Admin dismisses a duplicate flag (keeps the business; clears it from the queue).
  async resolveDuplicate(id: string, adminId?: string) {
    await this.prisma.business.update({ where: { id }, data: { duplicateReviewedAt: new Date() } });
    await this.prisma.auditLog.create({
      data: { entityType: 'BUSINESS', entityId: id, action: 'DUPLICATE_FLAG_DISMISSED', userId: adminId ?? null },
    });
    return { ok: true };
  }

  async adminOverview() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const [
      totalBusinesses,
      totalUsers,
      totalClients,
      pendingVerifications,
      activeSubscriptions,
      upcomingAppointments,
      recentAppointments,
      payments,
      prevPayments,
      businessesByPlan,
      verificationByStatus,
      recentBusinesses,
      flaggedDuplicates,
      newBusinessesThisPeriod,
      newBusinessesPrevPeriod,
      newUsersThisPeriod,
      newUsersPrevPeriod,
    ] = await Promise.all([
      this.prisma.business.count(),
      this.prisma.user.count(),
      this.prisma.client.count(),
      this.prisma.business.count({ where: { verificationStatus: 'PENDING' } }),
      this.prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] }, plan: { in: ['BASIC', 'PRO', 'UNLIMITED'] } } }),
      this.prisma.appointment.count({ where: { startsAt: { gte: now }, status: { in: ['PENDING', 'CONFIRMED'] } } }),
      this.prisma.appointment.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED', createdAt: { gte: thirtyDaysAgo } },
        _sum: { amountCents: true, refundedCents: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
        _sum: { amountCents: true, refundedCents: true },
      }),
      this.prisma.business.groupBy({ by: ['plan'], _count: { _all: true } }),
      this.prisma.business.groupBy({ by: ['verificationStatus'], _count: { _all: true } }),
      this.prisma.business.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true, name: true, email: true, slug: true, plan: true,
          complimentaryPlanExpiresAt: true, complimentaryPreviousPlan: true,
          verificationStatus: true, suspended: true, createdAt: true,
          subscription: { select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true } },
        },
      }),
      this.prisma.business.count({ where: { suspectedDuplicateOfId: { not: null }, duplicateReviewedAt: null } }),
      this.prisma.business.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.business.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    ]);

    const planCounts: Record<string, number> = { FREE: 0, BASIC: 0, PRO: 0, UNLIMITED: 0 };
    for (const row of businessesByPlan) planCounts[row.plan] = row._count._all;

    const verificationCounts = { UNVERIFIED: 0, PENDING: 0, VERIFIED: 0, REJECTED: 0 };
    for (const row of verificationByStatus) verificationCounts[row.verificationStatus] = row._count._all;

    const grossRevenueCents = payments._sum.amountCents ?? 0;
    const refundedCents = payments._sum.refundedCents ?? 0;
    const netRevenueCents = grossRevenueCents - refundedCents;

    const prevNetRevenue = (prevPayments._sum.amountCents ?? 0) - (prevPayments._sum.refundedCents ?? 0);
    const revenueTrendPct = prevNetRevenue > 0 ? Math.round(((netRevenueCents - prevNetRevenue) / prevNetRevenue) * 100) : null;
    const bizGrowthPct = newBusinessesPrevPeriod > 0 ? Math.round(((newBusinessesThisPeriod - newBusinessesPrevPeriod) / newBusinessesPrevPeriod) * 100) : null;
    const userGrowthPct = newUsersPrevPeriod > 0 ? Math.round(((newUsersThisPeriod - newUsersPrevPeriod) / newUsersPrevPeriod) * 100) : null;

    return {
      generatedAt: now,
      metrics: {
        totalBusinesses,
        totalUsers,
        totalClients,
        pendingVerifications,
        activeSubscriptions,
        upcomingAppointments,
        recentAppointments,
        grossRevenueCents,
        refundedCents,
        netRevenueCents,
        successfulPayments: payments._count,
        flaggedDuplicates,
        newBusinessesThisPeriod,
        newUsersThisPeriod,
      },
      trends: {
        revenueTrendPct,
        bizGrowthPct,
        userGrowthPct,
      },
      planCounts,
      verificationCounts,
      recentBusinesses,
    };
  }

  async listBusinessesAdmin(params: {
    page: number;
    limit: number;
    search?: string;
    plan?: string;
    verificationStatus?: string;
    suspended?: boolean;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }) {
    const { page, limit, search, plan, verificationStatus, suspended, sortBy = 'createdAt', sortDir = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.BusinessWhereInput = {};
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
        { slug: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }
    if (plan) where.plan = plan as PlanTier;
    if (verificationStatus) where.verificationStatus = verificationStatus as Prisma.EnumVerificationStatusFilter;
    if (suspended !== undefined) where.suspended = suspended;

    const allowedSortFields = ['createdAt', 'name', 'plan', 'verificationStatus'];
    const safeSort = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [total, businesses] = await Promise.all([
      this.prisma.business.count({ where }),
      this.prisma.business.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [safeSort]: sortDir },
        select: {
          id: true, name: true, email: true, slug: true, plan: true,
          verificationStatus: true, suspended: true, createdAt: true, phone: true,
          complimentaryPlanExpiresAt: true, complimentaryPreviousPlan: true,
          subscription: { select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true } },
          _count: { select: { appointments: true, staff: true, clients: true } },
        },
      }),
    ]);

    return { businesses, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async listAuditLog(params: { page: number; limit: number; entityType?: string; action?: string }) {
    const { page, limit, entityType, action } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = { contains: action, mode: 'insensitive' };

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    ]);

    const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean) as string[])];
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    return {
      logs: logs.map((l) => ({ ...l, user: l.userId ? (userMap[l.userId] ?? null) : null })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async setPlanAdmin(businessId: string, plan: PlanTier, adminId: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, plan: true, subscription: { select: { status: true } } },
    });
    if (!biz) throw new NotFoundException('Business not found');
    // A live Stripe subscription is the source of truth for the plan. Overriding
    // it here would let Stripe keep billing the old tier while the app shows a
    // different one (reconciliation desync). Force admins through Stripe instead.
    if (biz.subscription && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(biz.subscription.status)) {
      throw new BadRequestException('This business has active Stripe billing. Change its plan through Stripe billing controls instead.');
    }
    const result = await this.prisma.business.update({
      where: { id: businessId },
      data: { plan, complimentaryPlanExpiresAt: null, complimentaryPreviousPlan: null },
      select: { id: true, plan: true, complimentaryPlanExpiresAt: true },
    });
    await this.prisma.auditLog.create({
      data: {
        entityType: 'BUSINESS',
        entityId: businessId,
        action: 'ADMIN_PLAN_OVERRIDE',
        userId: adminId,
        changes: { from: biz.plan, to: plan },
      },
    });
    return result;
  }

  async grantComplimentaryPlan(
    businessId: string,
    plan: 'PRO' | 'UNLIMITED',
    months: number,
    adminId: string,
  ) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        plan: true,
        complimentaryPlanExpiresAt: true,
        complimentaryPreviousPlan: true,
        subscription: { select: { status: true } },
      },
    });
    if (!biz) throw new NotFoundException('Business not found');
    if (biz.subscription && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(biz.subscription.status)) {
      throw new BadRequestException('This business has active billing. Use Stripe billing controls instead.');
    }

    const expiresAt = addMonths(new Date(), months);
    const previousPlan = biz.complimentaryPlanExpiresAt && biz.complimentaryPlanExpiresAt > new Date()
      ? (biz.complimentaryPreviousPlan ?? 'FREE')
      : biz.plan;
    const result = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        plan,
        complimentaryPreviousPlan: previousPlan,
        complimentaryPlanExpiresAt: expiresAt,
      },
      select: {
        id: true,
        plan: true,
        complimentaryPlanExpiresAt: true,
        complimentaryPreviousPlan: true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        entityType: 'BUSINESS',
        entityId: businessId,
        action: 'ADMIN_COMPLIMENTARY_PLAN_GRANTED',
        userId: adminId,
        changes: { from: biz.plan, to: plan, months, expiresAt: expiresAt.toISOString() },
      },
    });
    // Tell the influencer/VIP what they received (email + in-app). Best-effort:
    // a notification hiccup must never fail the grant itself.
    await this.notifications
      .sendCompPlanGranted(businessId, { plan, expiresAt: expiresAt.toISOString() })
      .catch(() => {});
    return result;
  }

  async approve(businessId: string, adminId?: string) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
    if (!biz) throw new NotFoundException('Business not found');
    const result = await this.prisma.business.update({
      where: { id: businessId },
      data: { verificationStatus: 'VERIFIED', verifiedAt: new Date(), verificationNote: null },
      select: { verificationStatus: true, verifiedAt: true },
    });
    await this.prisma.auditLog.create({
      data: { entityType: 'BUSINESS', entityId: businessId, action: 'VERIFICATION_APPROVED', userId: adminId ?? null },
    });
    return result;
  }

  async reject(businessId: string, note?: string, adminId?: string) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
    if (!biz) throw new NotFoundException('Business not found');
    const result = await this.prisma.business.update({
      where: { id: businessId },
      data: { verificationStatus: 'REJECTED', verificationNote: note?.trim() || 'Document could not be verified.' },
      select: { verificationStatus: true, verificationNote: true },
    });
    await this.prisma.auditLog.create({
      data: { entityType: 'BUSINESS', entityId: businessId, action: 'VERIFICATION_REJECTED', userId: adminId ?? null, ...(note ? { changes: { note } } : {}) },
    });
    return result;
  }

  /**
   * Onboarding funnel: for every business, derive which setup steps are complete.
   * Steps: signed_up → added_service → added_staff → stripe_connected → first_booking → verified
   */
  async onboardingFunnel() {
    const businesses = await this.prisma.business.findMany({
      select: {
        id: true,
        name: true,
        plan: true,
        verificationStatus: true,
        stripeConnectAccountId: true,
        createdAt: true,
        _count: { select: { services: true, staff: true, appointments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = businesses.map((b) => ({
      id: b.id,
      name: b.name,
      plan: b.plan,
      createdAt: b.createdAt,
      signedUp: true,
      addedService: b._count.services > 0,
      addedStaff: b._count.staff > 0,
      stripeConnected: !!b.stripeConnectAccountId,
      firstBooking: b._count.appointments > 0,
      verified: b.verificationStatus === 'VERIFIED',
    }));

    const steps = ['signedUp', 'addedService', 'addedStaff', 'stripeConnected', 'firstBooking', 'verified'] as const;
    const totals = Object.fromEntries(steps.map((s) => [s, rows.filter((r) => r[s]).length])) as Record<typeof steps[number], number>;

    return { total: rows.length, totals, businesses: rows };
  }
}
