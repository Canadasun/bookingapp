import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { featuresUnlocked } from '../common/util/plan';

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

    // FREE: no extra locations. BASIC/PRO: up to 1 location. UNLIMITED: unlimited.
    // Bypassed while UNLOCK_ALL_FEATURES is enabled (launch/testing mode).
    if (!featuresUnlocked()) {
      if (business.plan === 'FREE') {
        throw new ForbiddenException('Managing multiple locations requires a Basic plan or higher.');
      }
      if ((business.plan === 'BASIC' || business.plan === 'PRO') && existing >= 1) {
        throw new ForbiddenException('Unlimited plan required to manage more than one location.');
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
      where: { id },
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
    await this.prisma.location.delete({ where: { id } });
    return { ok: true };
  }
}
