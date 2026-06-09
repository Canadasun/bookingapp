import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembershipsService {
  constructor(private prisma: PrismaService) {}

  // ── Plans ─────────────────────────────────────────────────────────────────

  listPlans(businessId: string) {
    return this.prisma.membershipPlan.findMany({ where: { businessId }, orderBy: { createdAt: 'asc' } });
  }

  createPlan(businessId: string, dto: { name: string; description?: string; priceMonthly: number }) {
    return this.prisma.membershipPlan.create({ data: { businessId, ...dto } });
  }

  async updatePlan(businessId: string, id: string, dto: Partial<{ name: string; description: string; priceMonthly: number; active: boolean }>) {
    const plan = await this.prisma.membershipPlan.findFirst({ where: { id, businessId } });
    if (!plan) throw new NotFoundException('Plan not found');
    return this.prisma.membershipPlan.update({ where: { id }, data: dto });
  }

  async deletePlan(businessId: string, id: string) {
    const plan = await this.prisma.membershipPlan.findFirst({ where: { id, businessId } });
    if (!plan) throw new NotFoundException('Plan not found');
    const active = await this.prisma.clientMembership.count({ where: { planId: id, status: 'ACTIVE' } });
    if (active > 0) throw new BadRequestException('Cannot delete a plan with active members. Deactivate it instead.');
    return this.prisma.membershipPlan.delete({ where: { id } });
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
    const [client, plan] = await Promise.all([
      this.prisma.client.findFirst({ where: { id: clientId, businessId } }),
      this.prisma.membershipPlan.findFirst({ where: { id: planId, businessId, active: true } }),
    ]);
    if (!client) throw new NotFoundException('Client not found');
    if (!plan) throw new NotFoundException('Plan not found');
    const existing = await this.prisma.clientMembership.findFirst({ where: { clientId, planId, status: 'ACTIVE' } });
    if (existing) throw new BadRequestException('Client already has an active membership on this plan');
    return this.prisma.clientMembership.create({
      data: { businessId, clientId, planId, status: 'ACTIVE' },
      include: { plan: { select: { name: true } } },
    });
  }

  async cancel(businessId: string, id: string) {
    const m = await this.prisma.clientMembership.findFirst({ where: { id, businessId } });
    if (!m) throw new NotFoundException('Membership not found');
    return this.prisma.clientMembership.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  clientMemberships(businessId: string, clientId: string) {
    return this.prisma.clientMembership.findMany({
      where: { businessId, clientId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
