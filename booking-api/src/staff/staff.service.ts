import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
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

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  findAll(businessId: string) {
    return this.prisma.staff.findMany({
      where: { businessId, active: true },
      include: { user: { select: { name: true, email: true } }, staffServices: true },
    });
  }

  async findOne(id: string, businessId?: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { 
        id,
        ...(businessId ? { businessId } : {})
      },
      include: {
        user: { select: { name: true, email: true } },
        staffServices: { include: { service: true } },
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
    return this.prisma.staff.create({
      data: { businessId, userId: dto.userId, bio: dto.bio, avatarUrl: dto.avatarUrl },
      include: { user: { select: { name: true, email: true } } },
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

    const tempPassword = randomBytes(9).toString('base64url').slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

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
      if (dto.serviceIds?.length) {
        await tx.staffService.createMany({
          data: dto.serviceIds.map((serviceId) => ({ staffId: s.id, serviceId })),
        });
      }
      return s;
    });

    return { staff: await this.findOne(staff.id), tempPassword };
  }

  async update(id: string, dto: { bio?: string; avatarUrl?: string; active?: boolean }, businessId?: string) {
    const staff = await this.findOne(id, businessId);
    return this.prisma.staff.update({
      where: { id: staff.id },
      data: {
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: {
        user: { select: { name: true, email: true } },
        staffServices: { include: { service: { select: { id: true, name: true, active: true } } } },
      },
    });
  }

  async deactivate(id: string, businessId?: string) {
    const staff = await this.findOne(id, businessId);
    return this.prisma.staff.update({ where: { id: staff.id }, data: { active: false } });
  }

  findAllIncludingInactive(businessId: string) {
    return this.prisma.staff.findMany({
      where: { businessId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        staffServices: { include: { service: { select: { id: true, name: true, active: true } } } },
        availabilityRules: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assignServices(staffId: string, dto: AssignServicesDto, businessId?: string) {
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
    return this.findOne(staff.id);
  }

  async setAvailabilityRules(staffId: string, rules: AvailabilityRuleDto[], businessId?: string) {
    const staff = await this.findOne(staffId, businessId);
    await this.prisma.availabilityRule.deleteMany({ where: { staffId: staff.id } });
    await this.prisma.availabilityRule.createMany({
      data: rules.map((r) => ({ staffId: staff.id, ...r })),
    });
    return this.prisma.availabilityRule.findMany({ where: { staffId: staff.id } });
  }

  async createTimeOff(staffId: string, dto: TimeOffDto, businessId?: string) {
    const staff = await this.findOne(staffId, businessId);
    return this.prisma.timeOff.create({
      data: { staffId: staff.id, startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt), reason: dto.reason },
    });
  }

  async getTimeOffs(staffId: string, businessId?: string) {
    const staff = await this.findOne(staffId, businessId);
    return this.prisma.timeOff.findMany({ where: { staffId: staff.id }, orderBy: { startsAt: 'asc' } });
  }

  async deleteTimeOff(id: string, businessId?: string) {
    const timeOff = await this.prisma.timeOff.findFirst({
      where: {
        id,
        staff: { businessId }
      }
    });
    if (!timeOff) throw new NotFoundException('Time off record not found');
    return this.prisma.timeOff.delete({ where: { id } });
  }
}
