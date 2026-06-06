import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VerificationService {
  constructor(private prisma: PrismaService) {}

  // Owner submits a registration document → status PENDING (awaiting admin).
  async submit(businessId: string, docUrl?: string) {
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
        // A document is optional — one click enters the queue; attaching a doc
        // just helps the admin review faster.
        ...(docUrl ? { verificationDocUrl: docUrl } : {}),
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
        verificationDocUrl: true, verificationSubmittedAt: true,
      },
    });
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
    ]);

    const planCounts = { FREE: 0, BASIC: 0, PRO: 0 };
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
}
