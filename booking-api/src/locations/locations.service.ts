import { BadRequestException, Injectable, Logger, NotFoundException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { featuresUnlocked } from '../common/util/plan';
import { isProPlan, isUnlimitedPlan } from '../common/util/plan-features';
import { uniqueLocationSlug } from '../common/util/slug';
import { PlanTier } from '@prisma/client';

@Injectable()
export class LocationsService implements OnModuleInit {
  private readonly logger = new Logger(LocationsService.name);

  constructor(private prisma: PrismaService) {}

  // Backfill slugs for locations created before per-location URLs existed.
  // Idempotent and self-healing: runs on every boot but only touches null-slug
  // rows, so it costs nothing once the fleet is migrated.
  async onModuleInit() {
    const pending = await this.prisma.location.findMany({
      where: { slug: null },
      select: { id: true, businessId: true, name: true },
    });
    if (pending.length === 0) return;
    for (const loc of pending) {
      const slug = await uniqueLocationSlug(this.prisma, loc.businessId, loc.name);
      await this.prisma.location.update({ where: { id: loc.id }, data: { slug } });
    }
    this.logger.log(`Backfilled slugs for ${pending.length} location(s)`);
  }

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

  async create(businessId: string, data: { name: string; address?: string; phone?: string; timezone?: string; defaultLocale?: 'en' | 'fr' | null; taxProvince?: string | null; taxRatePercent?: number | null; requireDeposit?: boolean | null; depositPercent?: number | null; cancellationWindowMinutes?: number | null; cancellationPolicy?: string | null }) {
    // New locations are active by default, so the same guard must be used for
    // creation and reactivation. Otherwise deactivate → create → reactivate
    // bypasses the subscription limit.
    await this.assertCanActivate(businessId);

    const name = data.name.trim();
    return this.prisma.location.create({
      data: {
        businessId,
        name,
        slug: await uniqueLocationSlug(this.prisma, businessId, name),
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        timezone: data.timezone?.trim() || null,
        defaultLocale: data.defaultLocale ?? null,
        taxProvince: data.taxProvince?.trim() || null,
        taxRatePercent: data.taxRatePercent ?? null,
        requireDeposit: data.requireDeposit ?? null,
        depositPercent: data.depositPercent ?? null,
        cancellationWindowMinutes: data.cancellationWindowMinutes ?? null,
        cancellationPolicy: data.cancellationPolicy?.trim() || null,
      },
    });
  }

  async update(id: string, businessId: string, data: { name?: string; address?: string; phone?: string; timezone?: string; defaultLocale?: 'en' | 'fr' | null; active?: boolean; taxProvince?: string | null; taxRatePercent?: number | null; requireDeposit?: boolean | null; depositPercent?: number | null; cancellationWindowMinutes?: number | null; cancellationPolicy?: string | null }) {
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
        ...(data.defaultLocale !== undefined ? { defaultLocale: data.defaultLocale } : {}),
        ...(data.taxProvince !== undefined ? { taxProvince: data.taxProvince?.trim() || null } : {}),
        ...(data.taxRatePercent !== undefined ? { taxRatePercent: data.taxRatePercent ?? null } : {}),
        ...(data.requireDeposit !== undefined ? { requireDeposit: data.requireDeposit } : {}),
        ...(data.depositPercent !== undefined ? { depositPercent: data.depositPercent ?? null } : {}),
        ...(data.cancellationWindowMinutes !== undefined ? { cancellationWindowMinutes: data.cancellationWindowMinutes ?? null } : {}),
        ...(data.cancellationPolicy !== undefined ? { cancellationPolicy: data.cancellationPolicy?.trim() || null } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
  }

  async remove(id: string, businessId: string) {
    const location = await this.prisma.location.findFirst({ where: { id, businessId } });
    if (!location) throw new NotFoundException('Location not found');
    const [appointmentCount, invoiceCount] = await Promise.all([
      this.prisma.appointment.count({ where: { businessId, locationId: location.id } }),
      this.prisma.invoice.count({ where: { businessId, locationId: location.id } }),
    ]);
    if (appointmentCount > 0 || invoiceCount > 0) {
      throw new BadRequestException({
        code: 'LOCATION_HAS_HISTORY',
        message: 'This location has appointment or invoice history and cannot be deleted. Deactivate it instead.',
      });
    }
    await this.prisma.location.delete({ where: { id: location.id, businessId: location.businessId } });
    return { ok: true };
  }
}
