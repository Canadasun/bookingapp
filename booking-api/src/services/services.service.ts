import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateServiceDto, UpdateServiceDto,
  CreateCategoryDto, UpdateCategoryDto,
} from './dto/service.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  private async assertCategoryOwnership(businessId: string, categoryId?: string | null) {
    if (!categoryId) return;
    const category = await this.prisma.serviceCategory.findFirst({
      where: { id: categoryId, businessId },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Category not found');
  }

  // ── Services ────────────────────────────────────────────────────────────────

  async findAll(businessId: string, includeInactive = false, locationIds?: string[]) {
    // When exactly one branch is in scope, honour its per-service overrides:
    // hide services it has disabled and apply its price override. With multiple
    // branches in scope a single effective price is ambiguous, so we skip it.
    const singleLocationId = locationIds?.length === 1 ? locationIds[0] : undefined;
    const services = await this.prisma.service.findMany({
      where: {
        businessId,
        ...(includeInactive ? {} : { active: true }),
        // Service availability is configured through staff/service assignments.
        // A service is available at a branch when an active provider who serves
        // that branch offers it. A provider serves a branch via the StaffLocation
        // junction (multi-location); the singular locationId is the fallback for
        // any provider not yet backfilled into the junction.
        ...(locationIds?.length ? {
          staffServices: { some: { staff: { active: true, OR: [
            { staffLocations: { some: { locationId: { in: locationIds } } } },
            { locationId: { in: locationIds } },
          ] } } },
        } : {}),
        // Hide services this branch has explicitly disabled.
        ...(singleLocationId ? {
          NOT: { locationServices: { some: { locationId: singleLocationId, enabled: false } } },
        } : {}),
      },
      include: {
        category: { select: { id: true, name: true, color: true, sortOrder: true } },
        ...(singleLocationId ? { locationServices: { where: { locationId: singleLocationId }, select: { priceCents: true, enabled: true } } } : {}),
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    if (!singleLocationId) return services;
    // Apply the branch price override to the returned price, then drop the join.
    return services.map((svc) => {
      const override = (svc as typeof svc & { locationServices?: { priceCents: number | null }[] }).locationServices?.[0];
      const { locationServices, ...rest } = svc as typeof svc & { locationServices?: unknown };
      return { ...rest, priceCents: override?.priceCents != null ? override.priceCents : svc.priceCents };
    });
  }

  async findOne(id: string, businessId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, businessId },
      include: { category: { select: { id: true, name: true, color: true, sortOrder: true } } },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async create(businessId: string, dto: CreateServiceDto) {
    const { categoryId, ...rest } = dto;
    await this.assertCategoryOwnership(businessId, categoryId);
    return this.prisma.service.create({
      data: {
        ...rest,
        businessId,
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: { select: { id: true, name: true, color: true, sortOrder: true } } },
    });
  }

  async update(id: string, dto: UpdateServiceDto, businessId: string) {
    const service = await this.findOne(id, businessId);
    const { categoryId, ...rest } = dto;
    await this.assertCategoryOwnership(businessId, categoryId);
    return this.prisma.service.update({
      where: { id: service.id, businessId: service.businessId },
      data: {
        ...rest,
        ...(categoryId !== undefined ? { categoryId: categoryId ?? null } : {}),
      },
      include: { category: { select: { id: true, name: true, color: true, sortOrder: true } } },
    });
  }

  // Per-location price/enablement overrides for one service.
  async getLocationOverrides(serviceId: string, businessId: string) {
    await this.findOne(serviceId, businessId); // tenant check
    return this.prisma.locationService.findMany({
      where: { serviceId, location: { businessId } },
      select: { locationId: true, enabled: true, priceCents: true },
    });
  }

  async setLocationOverrides(
    serviceId: string,
    businessId: string,
    overrides: { locationId: string; enabled: boolean; priceCents: number | null }[],
  ) {
    await this.findOne(serviceId, businessId); // tenant check
    const ids = [...new Set(overrides.map((o) => o.locationId))];
    if (ids.length) {
      const valid = await this.prisma.location.count({ where: { id: { in: ids }, businessId } });
      if (valid !== ids.length) throw new NotFoundException('One or more locations do not belong to this business');
    }
    await this.prisma.$transaction([
      this.prisma.locationService.deleteMany({ where: { serviceId, location: { businessId } } }),
      // Only persist rows that actually diverge from the base (disabled or a price
      // override) — an enabled row at the base price is the default, so skip it.
      ...overrides
        .filter((o) => !o.enabled || o.priceCents != null)
        .map((o) => this.prisma.locationService.create({
          data: { serviceId, locationId: o.locationId, enabled: o.enabled, priceCents: o.priceCents },
        })),
    ]);
    return this.getLocationOverrides(serviceId, businessId);
  }

  async remove(id: string, businessId: string) {
    const service = await this.findOne(id, businessId);
    const appointments = await this.prisma.appointment.count({ where: { serviceId: service.id } });
    if (appointments > 0) {
      throw new BadRequestException('This service has appointment history and cannot be permanently deleted.');
    }
    return this.prisma.service.delete({ where: { id: service.id, businessId: service.businessId } });
  }

  // ── Categories ───────────────────────────────────────────────────────────────

  findAllCategories(businessId: string, includeInactive = false) {
    return this.prisma.serviceCategory.findMany({
      where: { businessId, ...(includeInactive ? {} : { active: true }) },
      include: {
        services: {
          where: includeInactive ? {} : { active: true },
          include: { category: { select: { id: true, name: true, color: true, sortOrder: true } } },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  createCategory(businessId: string, dto: CreateCategoryDto) {
    return this.prisma.serviceCategory.create({
      data: { ...dto, businessId },
      include: { services: true },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, businessId: string) {
    const cat = await this.prisma.serviceCategory.findFirst({
      where: { id, businessId }
    });
    if (!cat) throw new NotFoundException('Category not found');
    return this.prisma.serviceCategory.update({
      where: { id, businessId: cat.businessId },
      data: dto,
      include: { services: { include: { category: true } } },
    });
  }

  async removeCategory(id: string, businessId: string) {
    const cat = await this.prisma.serviceCategory.findFirst({
      where: { id, businessId }
    });
    if (!cat) throw new NotFoundException('Category not found');
    await this.prisma.service.updateMany({ where: { categoryId: id, businessId }, data: { categoryId: null } });
    return this.prisma.serviceCategory.delete({ where: { id, businessId: cat.businessId } });
  }
}
