import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { featuresUnlocked } from '../common/util/plan';
import { isProPlan, isUnlimitedPlan } from '../common/util/plan-features';
import { PlanTier } from '@prisma/client';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  private locationLimit(plan: PlanTier) {
    return isUnlimitedPlan(plan) ? 5 : isProPlan(plan) ? 2 : 1;
  }

  private async assertCanActivate(businessId: string) {
    if (featuresUnlocked()) return;
    const [business, activeCount] = await Promise.all([
      this.prisma.business.findUniqueOrThrow({
        where: { id: businessId },
        select: { plan: true },
      }),
      this.prisma.location.count({ where: { businessId, active: true } }),
    ]);
    const limit = this.locationLimit(business.plan);
    if (activeCount < limit) return;
    const upgrade = isUnlimitedPlan(business.plan) ? null : isProPlan(business.plan) ? 'Unlimited' : 'Pro or Unlimited';
    throw new ForbiddenException(
      upgrade
        ? `Your plan allows ${limit} location${limit === 1 ? '' : 's'}. Upgrade to ${upgrade} to add more.`
        : `Unlimited plan supports up to 5 locations. Contact support if you need more.`,
    );
  }

  findAll(businessId: string, includeInactive = false) {
    return this.prisma.location.findMany({
      where: { businessId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { name: 'asc' },
    });
  }

  async create(businessId: string, data: { name: string; address?: string; phone?: string; timezone?: string; taxProvince?: string | null; taxRatePercent?: number | null }) {
    // New locations are active by default, so the same guard must be used for
    // creation and reactivation. Otherwise deactivate → create → reactivate
    // bypasses the subscription limit.
    await this.assertCanActivate(businessId);

    return this.prisma.location.create({
      data: {
        businessId,
        name: data.name.trim(),
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        timezone: data.timezone?.trim() || null,
        taxProvince: data.taxProvince?.trim() || null,
        taxRatePercent: data.taxRatePercent ?? null,
      },
    });
  }

  async update(id: string, businessId: string, data: { name?: string; address?: string; phone?: string; timezone?: string; active?: boolean; taxProvince?: string | null; taxRatePercent?: number | null }) {
    const location = await this.prisma.location.findFirst({ where: { id, businessId } });
    if (!location) throw new NotFoundException('Location not found');
    if (data.active === true && !location.active) {
      await this.assertCanActivate(businessId);
    }
    return this.prisma.location.update({
      where: { id: location.id, businessId: location.businessId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.address !== undefined ? { address: data.address.trim() || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone.trim() || null } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone.trim() || null } : {}),
        ...(data.taxProvince !== undefined ? { taxProvince: data.taxProvince?.trim() || null } : {}),
        ...(data.taxRatePercent !== undefined ? { taxRatePercent: data.taxRatePercent ?? null } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
  }

  async remove(id: string, businessId: string) {
    const location = await this.prisma.location.findFirst({ where: { id, businessId } });
    if (!location) throw new NotFoundException('Location not found');
    // Staff/appointments referencing it are detached via ON DELETE SET NULL.
    await this.prisma.location.delete({ where: { id: location.id, businessId: location.businessId } });
    return { ok: true };
  }
}
