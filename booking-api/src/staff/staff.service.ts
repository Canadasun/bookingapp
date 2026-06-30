import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStaffDto,
  AvailabilityRuleDto,
  TimeOffDto,
  AssignServicesDto,
  InviteStaffDto,
} from './dto/staff.dto';
import { isUnlimitedPlan } from '../common/util/plan-features';
import { deleteUploadByUrl } from '../uploads/upload-cleanup';

// Non-Unlimited plans cap the number of active staff accounts.
// UNLIMITED advertises "unlimited staff accounts" as a differentiator.
const STAFF_LIMITS: Record<string, number> = { FREE: 5, BASIC: 10, PRO: 10 };

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  // Public (booking flow): names only — never expose staff emails here.
  async findAll(businessId: string) {
    await this.ensureOwnerProvider(businessId);
    return this.prisma.staff.findMany({
      where: { businessId, active: true },
      include: {
        user: { select: { name: true, role: true } },
        staffServices: true,
        staffLocations: { select: { locationId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, businessId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id, businessId },
      include: {
        user: { select: { name: true, email: true, role: true } },
        staffServices: { include: { service: true } },
        staffLocations: { select: { locationId: true } },
        availabilityRules: true,
      },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    return staff;
  }

  async create(businessId: string, dto: CreateStaffDto) {
    // The linked user must belong to this business (no cross-business linking).
    const user = await this.prisma.user.findFirst({ where: { id: dto.userId, businessId } });
    if (!user) throw new NotFoundException('User not found in this business');
    await this.enforceStaffLimit(businessId);
    return this.prisma.staff.create({
      data: { businessId, userId: dto.userId, bio: dto.bio, avatarUrl: dto.avatarUrl },
      include: { user: { select: { name: true, email: true, role: true } } },
    });
  }

  // Owner-only: create a STAFF user + staff record with a random one-time
  // temporary password. The user is flagged mustResetPassword so they're forced
  // to set their own password on first login. The temp password is returned
  // ONCE for the owner to relay — it is never stored in plaintext or shown again.
  async invite(
    businessId: string,
    dto: InviteStaffDto,
    requester: { role: string; businessId: string | null },
  ) {
    if (requester.role !== 'ADMIN' && requester.businessId !== businessId) {
      throw new ForbiddenException('You can only invite staff to your own business');
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');
    await this.enforceStaffLimit(businessId);

    const serviceIds = [...new Set(dto.serviceIds ?? [])];
    if (serviceIds.length) {
      const serviceCount = await this.prisma.service.count({
        where: { id: { in: serviceIds }, businessId },
      });
      if (serviceCount !== serviceIds.length) throw new NotFoundException('Service not found');
    }

    const tempPassword = randomBytes(9).toString('base64url').slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const staff = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: 'STAFF',
          businessId,
          mustResetPassword: true,
        },
      });
      const s = await tx.staff.create({ data: { businessId, userId: user.id, bio: dto.bio } });
      if (serviceIds.length) {
        await tx.staffService.createMany({
          data: serviceIds.map((serviceId) => ({ staffId: s.id, serviceId })),
        });
      }
      return s;
    });

    return { staff: await this.findOne(staff.id, businessId), tempPassword };
  }

  async update(id: string, dto: { bio?: string; avatarUrl?: string; active?: boolean; permissions?: string[]; locationId?: string | null; locationIds?: string[] }, businessId: string) {
    const staff = await this.findOne(id, businessId);

    // Resolve the full set of branches this provider should serve. `locationIds`
    // (multi-location) takes precedence; a legacy single `locationId` maps to a
    // one-element set. `undefined` means "leave branch assignment untouched".
    let nextLocationIds: string[] | undefined;
    if (dto.locationIds !== undefined) {
      nextLocationIds = [...new Set(dto.locationIds)];
    } else if (dto.locationId !== undefined) {
      nextLocationIds = dto.locationId ? [dto.locationId] : [];
    }
    if (nextLocationIds && nextLocationIds.length) {
      const valid = await this.prisma.location.count({
        where: { id: { in: nextLocationIds }, businessId, active: true },
      });
      if (valid !== nextLocationIds.length) throw new NotFoundException('One or more active locations not found');
    }

    // Keep Staff.locationId as the primary/home branch: prefer the existing
    // primary if it's still in the set, otherwise the first selected branch.
    const nextPrimary = nextLocationIds === undefined
      ? undefined
      : nextLocationIds.includes(staff.locationId ?? '')
        ? staff.locationId
        : (nextLocationIds[0] ?? null);

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.staff.update({
        where: { id: staff.id, businessId: staff.businessId },
        data: {
          ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
          ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(dto.permissions !== undefined ? { permissions: dto.permissions } : {}),
          ...(nextPrimary !== undefined ? { locationId: nextPrimary } : {}),
        },
        include: {
          user: { select: { name: true, email: true, role: true } },
          staffServices: { include: { service: { select: { id: true, name: true, active: true } } } },
          staffLocations: { select: { locationId: true } },
        },
      });
      if (nextLocationIds !== undefined) {
        await tx.staffLocation.deleteMany({ where: { staffId: staff.id } });
        if (nextLocationIds.length) {
          await tx.staffLocation.createMany({
            data: nextLocationIds.map((locationId) => ({ staffId: staff.id, locationId })),
          });
        }
        u.staffLocations = nextLocationIds.map((locationId) => ({ locationId }));
      }
      return u;
    });
    if (dto.avatarUrl !== undefined && staff.avatarUrl && staff.avatarUrl !== dto.avatarUrl) {
      await deleteUploadByUrl(this.prisma, staff.avatarUrl);
    }
    return updated;
  }

  async deactivate(id: string, businessId: string) {
    const staff = await this.findOne(id, businessId);
    return this.prisma.staff.update({ where: { id: staff.id, businessId: staff.businessId }, data: { active: false } });
  }

  // Permanently remove a provider + their login. Never allowed for the owner.
  // A provider with bookings can't be deleted outright (Appointment→Staff is
  // Restrict, to protect history) — but with { force } the owner can delete them
  // anyway: their bookings are first moved to the owner's own provider record
  // (created if needed), so nothing is lost.
  async remove(id: string, businessId: string, opts: { force?: boolean } = {}) {
    const staff = await this.findOne(id, businessId);
    const user = await this.prisma.user.findUnique({ where: { id: staff.userId }, select: { role: true } });
    if (user?.role === 'OWNER') {
      throw new BadRequestException("You can't remove yourself as a provider — deactivate instead if you're not taking bookings.");
    }
    const aptCount = await this.prisma.appointment.count({ where: { staffId: staff.id } });
    if (aptCount > 0) {
      if (!opts.force) {
        // Surface a structured reason so the dashboard can offer the move-and-delete.
        throw new BadRequestException({
          code: 'HAS_BOOKINGS',
          message: `This provider has ${aptCount} booking${aptCount > 1 ? 's' : ''}. Delete anyway and move ${aptCount > 1 ? 'them' : 'it'} to you (the owner)?`,
        });
      }
      const ownerStaffId = await this.ensureOwnerProvider(staff.businessId);
      if (ownerStaffId !== staff.id) {
        await this.prisma.appointment.updateMany({ where: { staffId: staff.id, businessId: staff.businessId }, data: { staffId: ownerStaffId } });
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.staff.delete({ where: { id: staff.id, businessId: staff.businessId } });       // cascades services/availability/time-off
      await tx.user.delete({ where: { id: staff.userId } });    // remove their login too
    });
    return { ok: true };
  }

  private async enforceStaffLimit(businessId: string) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { plan: true } });
    if (!biz || isUnlimitedPlan(biz.plan)) return;
    const limit = STAFF_LIMITS[biz.plan ?? 'FREE'] ?? 5;
    const count = await this.prisma.staff.count({ where: { businessId, active: true } });
    if (count >= limit) {
      throw new ForbiddenException(
        `Your ${biz.plan} plan supports up to ${limit} active staff members. Upgrade to Unlimited for unlimited staff.`,
      );
    }
  }

  // The owner is the fallback provider (sole-proprietor model). Ensure they have
  // an active Staff record and return its id, so a departing provider's bookings
  // have somewhere to go.
  async ensureOwnerProvider(businessId: string): Promise<string> {
    const owner = await this.prisma.user.findFirst({ where: { businessId, role: 'OWNER' } });
    if (!owner) throw new BadRequestException('No owner account found to receive the bookings.');
    const existing = await this.prisma.staff.findUnique({ where: { userId: owner.id } });
    if (existing) {
      if (!existing.active) await this.prisma.staff.update({ where: { id: existing.id, businessId: existing.businessId }, data: { active: true } });
      return existing.id;
    }
    const created = await this.prisma.staff.create({ data: { businessId, userId: owner.id, active: true } });
    return created.id;
  }

  async findAllIncludingInactive(businessId: string) {
    await this.ensureOwnerProvider(businessId);
    return this.prisma.staff.findMany({
      where: { businessId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        staffServices: { include: { service: { select: { id: true, name: true, active: true } } } },
        staffLocations: { select: { locationId: true } },
        availabilityRules: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assignServices(staffId: string, dto: AssignServicesDto, businessId: string) {
    const staff = await this.findOne(staffId, businessId);
    // Every service must belong to the staff member's business — no assigning
    // another business's services.
    if (dto.serviceIds.length) {
      const valid = await this.prisma.service.count({
        where: { id: { in: dto.serviceIds }, businessId: staff.businessId },
      });
      if (valid !== new Set(dto.serviceIds).size) {
        throw new NotFoundException('One or more services do not belong to this business');
      }
    }
    await this.prisma.staffService.deleteMany({ where: { staffId: staff.id } });
    await this.prisma.staffService.createMany({
      data: dto.serviceIds.map((serviceId) => ({ staffId: staff.id, serviceId })),
    });
    return this.findOne(staff.id, staff.businessId);
  }

  async setAvailabilityRules(staffId: string, rules: AvailabilityRuleDto[], businessId: string) {
    const staff = await this.findOne(staffId, businessId);
    await this.prisma.availabilityRule.deleteMany({ where: { staffId: staff.id } });
    await this.prisma.availabilityRule.createMany({
      data: rules.map((r) => ({ staffId: staff.id, ...r })),
    });
    return this.prisma.availabilityRule.findMany({ where: { staffId: staff.id } });
  }

  async createTimeOff(staffId: string, dto: TimeOffDto, businessId: string) {
    const staff = await this.findOne(staffId, businessId);
    return this.prisma.timeOff.create({
      data: { staffId: staff.id, startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt), reason: dto.reason },
    });
  }

  async getTimeOffs(staffId: string, businessId: string) {
    const staff = await this.findOne(staffId, businessId);
    return this.prisma.timeOff.findMany({ where: { staffId: staff.id }, orderBy: { startsAt: 'asc' } });
  }

  async deleteTimeOff(id: string, businessId: string) {
    const timeOff = await this.prisma.timeOff.findFirst({
      where: { id, staff: { businessId } },
    });
    if (!timeOff) throw new NotFoundException('Time off record not found');
    return this.prisma.timeOff.delete({ where: { id, staff: { businessId } } });
  }
}
