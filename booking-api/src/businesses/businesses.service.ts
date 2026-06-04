import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';
import { applyPlanLimits } from '../common/util/plan-features';

@Injectable()
export class BusinessesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBusinessDto, ownerId: string) {
    const existing = await this.prisma.business.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already taken');
    const business = await this.prisma.business.create({
      data: { ...dto, bookingPageSettings: (dto.bookingPageSettings ?? {}) as Prisma.InputJsonValue },
    });
    await this.prisma.user.update({
      where: { id: ownerId },
      data: { businessId: business.id, role: 'OWNER' },
    });
    return business;
  }

  async findOne(id: string) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  async findBySlug(slug: string) {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  // Public booking page: omit internal/sensitive fields (contact email, plan,
  // subscription expiry) — keep only what the booking flow legitimately needs.
  async findBySlugPublic(slug: string) {
    const business = await this.findBySlug(slug);
    const { email: _email, plan: _plan, planExpiresAt: _planExpiresAt, ...pub } = business;
    return pub;
  }

  async findPublicById(id: string) {
    const business = await this.findOne(id);
    const { email: _email, plan: _plan, planExpiresAt: _planExpiresAt, ...pub } = business;
    return pub;
  }

  async update(id: string, dto: UpdateBusinessDto) {
    const current = await this.findOne(id);
    const { bookingPageSettings, ...rest } = dto;
    const limited = applyPlanLimits(current.plan, rest);
    return this.prisma.business.update({
      where: { id },
      data: {
        ...limited,
        ...(bookingPageSettings !== undefined
          ? { bookingPageSettings: bookingPageSettings as Prisma.InputJsonValue }
          : {}),
      },
    });
  }
}
