import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { isPaidPlan } from '../common/util/plan-features';

@Injectable()
export class MembershipsService {
  constructor(private prisma: PrismaService, private payments: PaymentsService) {}

  private async assertMembershipsEnabled(businessId: string) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { plan: true } });
    if (!business) throw new NotFoundException('Business not found');
    if (!isPaidPlan(business.plan)) throw new BadRequestException('Memberships require a paid Pulse plan');
  }

  // ── Plans ─────────────────────────────────────────────────────────────────

  listPlans(businessId: string) {
    return this.prisma.membershipPlan.findMany({ where: { businessId }, orderBy: { createdAt: 'asc' } });
  }

  async createPlan(businessId: string, dto: { name: string; description?: string; priceMonthly: number }) {
    await this.assertMembershipsEnabled(businessId);
    return this.prisma.membershipPlan.create({ data: { businessId, ...dto } });
  }

  async updatePlan(businessId: string, id: string, dto: Partial<{ name: string; description: string; priceMonthly: number; active: boolean }>) {
    await this.assertMembershipsEnabled(businessId);
    const plan = await this.prisma.membershipPlan.findFirst({ where: { id, businessId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (dto.priceMonthly !== undefined && dto.priceMonthly !== plan.priceMonthly) {
      const billedMembers = await this.prisma.clientMembership.count({
        where: { planId: id, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      });
      if (billedMembers > 0) {
        throw new BadRequestException('Create a new plan to change pricing for future members');
      }
    }
    const priceChanging = dto.priceMonthly !== undefined && dto.priceMonthly !== plan.priceMonthly;
    const updated = await this.prisma.membershipPlan.update({
      where: { id: plan.id, businessId: plan.businessId },
      data: {
        ...dto,
        // Stripe prices are immutable. A price change must provision a fresh
        // recurring price for future enrollments while existing subscriptions
        // continue on their original contracted price.
        ...(priceChanging ? { stripeProductId: null, stripePriceId: null } : {}),
      },
    });
    if (priceChanging && plan.stripePriceId) {
      await this.payments.archiveMembershipPlanStripe(plan.stripePriceId, plan.stripeProductId).catch(() => {});
    }
    return updated;
  }

  async deletePlan(businessId: string, id: string) {
    const plan = await this.prisma.membershipPlan.findFirst({ where: { id, businessId } });
    if (!plan) throw new NotFoundException('Plan not found');
    const active = await this.prisma.clientMembership.count({ where: { planId: id, status: 'ACTIVE' } });
    if (active > 0) throw new BadRequestException('Cannot delete a plan with active members. Deactivate it instead.');
    return this.prisma.membershipPlan.delete({ where: { id: plan.id, businessId: plan.businessId } });
  }

  // ── Memberships ───────────────────────────────────────────────────────────

  listMembers(businessId: string) {
    return this.prisma.clientMembership.findMany({
      where: { businessId },
      include: { client: { select: { id: true, name: true, email: true, phone: true } }, plan: { select: { id: true, name: true, priceMonthly: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async subscribe(businessId: string, clientId: string, planId: string) {
    await this.assertMembershipsEnabled(businessId);
    return this.payments.createClientMembershipCheckout(businessId, clientId, planId);
  }

  confirm(businessId: string, sessionId: string) {
    return this.payments.confirmClientMembershipCheckout(businessId, sessionId);
  }

  async cancel(businessId: string, id: string) {
    return this.payments.cancelClientMembership(businessId, id);
  }

  clientMemberships(businessId: string, clientId: string) {
    return this.prisma.clientMembership.findMany({
      where: { businessId, clientId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
