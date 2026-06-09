import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VerificationService {
  constructor(private prisma: PrismaService) {}

  async submit(businessId: string, input: {
    legalName: string;
    address: string;
    phone: string;
    governmentIdUrl: string;
    registrationDocUrl: string;
  }) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { verificationStatus: true },
    });
    if (!biz) throw new NotFoundException('Business not found');
    if (biz.verificationStatus === 'VERIFIED') {
      throw new BadRequestException('This business is already verified.');
    }
    return this.prisma.business.update({
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
  async resolveDuplicate(id: string) {
    await this.prisma.business.update({ where: { id }, data: { duplicateReviewedAt: new Date() } });
    return { ok: true };
  }

  async adminOverview() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
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
      businessesByPlan,
      verificationByStatus,
      recentBusinesses,
      flaggedDuplicates,
    ] = await Promise.all([
      this.prisma.business.count(),
      this.prisma.user.count(),
      this.prisma.client.count(),
      this.prisma.business.count({ where: { verificationStatus: 'PENDING' } }),
      this.prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] }, plan: { in: ['BASIC', 'PRO'] } } }),
      this.prisma.appointment.count({ where: { startsAt: { gte: now }, status: { in: ['PENDING', 'CONFIRMED'] } } }),
      this.prisma.appointment.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED', createdAt: { gte: thirtyDaysAgo } },
        _sum: { amountCents: true, refundedCents: true },
        _count: true,
      }),
      this.prisma.business.groupBy({ by: ['plan'], _count: { _all: true } }),
      this.prisma.business.groupBy({ by: ['verificationStatus'], _count: { _all: true } }),
      this.prisma.business.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          name: true,
          email: true,
          slug: true,
          plan: true,
          verificationStatus: true,
          suspended: true,
          createdAt: true,
          subscription: {
            select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
          },
        },
      }),
      this.prisma.business.count({ where: { suspectedDuplicateOfId: { not: null }, duplicateReviewedAt: null } }),
    ]);

    const planCounts: Record<string, number> = { FREE: 0, BASIC: 0, PRO: 0, UNLIMITED: 0 };
    for (const row of businessesByPlan) planCounts[row.plan] = row._count._all;

    const verificationCounts = { UNVERIFIED: 0, PENDING: 0, VERIFIED: 0, REJECTED: 0 };
    for (const row of verificationByStatus) verificationCounts[row.verificationStatus] = row._count._all;

    const grossRevenueCents = payments._sum.amountCents ?? 0;
    const refundedCents = payments._sum.refundedCents ?? 0;

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
        netRevenueCents: grossRevenueCents - refundedCents,
        successfulPayments: payments._count,
        flaggedDuplicates,
      },
      planCounts,
      verificationCounts,
      recentBusinesses,
    };
  }

  async approve(businessId: string) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
    if (!biz) throw new NotFoundException('Business not found');
    return this.prisma.business.update({
      where: { id: businessId },
      data: { verificationStatus: 'VERIFIED', verifiedAt: new Date(), verificationNote: null },
      select: { verificationStatus: true, verifiedAt: true },
    });
  }

  async reject(businessId: string, note?: string) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
    if (!biz) throw new NotFoundException('Business not found');
    return this.prisma.business.update({
      where: { id: businessId },
      data: { verificationStatus: 'REJECTED', verificationNote: note?.trim() || 'Document could not be verified.' },
      select: { verificationStatus: true, verificationNote: true },
    });
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
