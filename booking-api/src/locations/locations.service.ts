import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { featuresUnlocked } from '../common/util/plan';
import { isProPlan, isUnlimitedPlan } from '../common/util/plan-features';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  findAll(businessId: string, includeInactive = false) {
    return this.prisma.location.findMany({
      where: { businessId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { name: 'asc' },
    });
  }

  async create(businessId: string, data: { name: string; address?: string; phone?: string; timezone?: string }) {
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { plan: true },
    });

    const existing = await this.prisma.location.count({ where: { businessId, active: true } });

    if (!featuresUnlocked()) {
      // Location limits by plan: Free/Basic=1, Pro=2, Unlimited=5
      const limit = isUnlimitedPlan(business.plan) ? 5 : isProPlan(business.plan) ? 2 : 1;
      if (existing >= limit) {
        const upgrade = isProPlan(business.plan) ? 'Unlimited' : isUnlimitedPlan(business.plan) ? null : 'Pro or Unlimited';
        const msg = upgrade
          ? `Your plan allows ${limit} location${limit === 1 ? '' : 's'}. Upgrade to ${upgrade} to add more.`
          : `Unlimited plan supports up to 5 locations. Contact support if you need more.`;
        throw new ForbiddenException(msg);
      }
    }

    return this.prisma.location.create({
      data: {
        businessId,
        name: data.name.trim(),
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        timezone: data.timezone?.trim() || null,
      },
    });
  }

  async update(id: string, businessId: string, data: { name?: string; address?: string; phone?: string; timezone?: string; active?: boolean }) {
    const location = await this.prisma.location.findFirst({ where: { id, businessId } });
    if (!location) throw new NotFoundException('Location not found');
    return this.prisma.location.update({
      where: { id: location.id, businessId: location.businessId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.address !== undefined ? { address: data.address.trim() || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone.trim() || null } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone.trim() || null } : {}),
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
