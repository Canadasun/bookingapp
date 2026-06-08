import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
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
    const { bookingPageSettings, notificationSettings, ...rest } = dto;
    const business = await this.prisma.business.create({
      data: {
        ...rest,
        bookingPageSettings: (bookingPageSettings ?? {}) as Prisma.InputJsonValue,
        notificationSettings: (notificationSettings ?? {}) as Prisma.InputJsonValue,
      },
    });
    await this.prisma.user.update({
      where: { id: ownerId },
      data: { businessId: business.id, role: 'OWNER' },
    });

    // Anti-duplicate: flag the new account if another business shares the same normalized
    // name + phone. Never blocks signup — just sets suspectedDuplicateOfId for admin review.
    await this.flagIfDuplicate(business.id, dto.name, dto.phone ?? null);

    return business;
  }

  private async flagIfDuplicate(newId: string, name: string, phone: string | null) {
    try {
      const normPhone = phone?.replace(/\D/g, '') ?? '';
      const normName = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      if (!normName) return;

      // Load recent businesses to compare in-memory (avoid unindexed LIKE scans).
      const candidates = await this.prisma.business.findMany({
        where: {
          id: { not: newId },
          ...(normPhone.length >= 7 ? { phone: { contains: normPhone.slice(-7) } } : {}),
        },
        select: { id: true, name: true, phone: true },
        take: 50,
      });

      const matched = candidates.find((c) => {
        const cNorm = c.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        return cNorm === normName;
      });

      if (matched) {
        await this.prisma.business.update({
          where: { id: newId },
          data: { suspectedDuplicateOfId: matched.id },
        });
      }
    } catch { /* duplicate check is best-effort; never block account creation */ }
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
    // A deactivated business is hidden from the public — its booking page reads
    // as "not found" so no new bookings can come in while it's paused.
    if (business.suspended) throw new NotFoundException('This business is not currently accepting online bookings');
    const {
      email: _email,
      plan: _plan,
      planExpiresAt: _planExpiresAt,
      verificationDocUrl: _verificationDocUrl,
      verificationGovernmentIdUrl: _verificationGovernmentIdUrl,
      verificationLegalName: _verificationLegalName,
      verificationAddress: _verificationAddress,
      verificationPhone: _verificationPhone,
      verificationNote: _verificationNote,
      verificationSubmittedAt: _verificationSubmittedAt,
      ...pub
    } = business;
    // Active locations so the booking page can offer a location step (multi-location).
    const locations = await this.prisma.location.findMany({
      where: { businessId: business.id, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, address: true },
    });
    return { ...pub, locations };
  }

  async findPublicById(id: string) {
    const business = await this.findOne(id);
    if (business.suspended) throw new NotFoundException('This business is not currently accepting online bookings');
    const {
      email: _email,
      plan: _plan,
      planExpiresAt: _planExpiresAt,
      verificationDocUrl: _verificationDocUrl,
      verificationGovernmentIdUrl: _verificationGovernmentIdUrl,
      verificationLegalName: _verificationLegalName,
      verificationAddress: _verificationAddress,
      verificationPhone: _verificationPhone,
      verificationNote: _verificationNote,
      verificationSubmittedAt: _verificationSubmittedAt,
      ...pub
    } = business;
    return pub;
  }

  // Owner pauses their business: keeps all data, hides the public booking page,
  // and stops new public bookings. Fully reversible via reactivate().
  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.business.update({ where: { id }, data: { suspended: true } });
  }

  async reactivate(id: string) {
    await this.findOne(id);
    return this.prisma.business.update({ where: { id }, data: { suspended: false } });
  }

  // Permanent, irreversible account deletion: erases the business and ALL of its
  // data (clients, bookings, staff, catalogue, payments, the owner's user, …).
  // Requires the owner to type the business name back as a safety confirmation.
  // Order matters: appointments first (they Restrict staff/service/client deletes),
  // then everything else, then the users, then the business itself.
  async deleteAccount(id: string, confirmation: string) {
    const business = await this.findOne(id);
    if (confirmation.trim().toLowerCase() !== business.name.trim().toLowerCase()) {
      throw new BadRequestException('Type your business name exactly to confirm deletion.');
    }
    const users = await this.prisma.user.findMany({ where: { businessId: id }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    const byBiz = { where: { businessId: id } };
    await this.prisma.$transaction(async (tx) => {
      // appointment-scoped + appointments (clears the Restrict edges)
      await tx.refund.deleteMany(byBiz);
      await tx.payment.deleteMany(byBiz);
      await tx.review.deleteMany(byBiz);
      await tx.message.deleteMany(byBiz);
      await tx.serviceDue.deleteMany(byBiz);
      await tx.appointment.deleteMany(byBiz);
      // catalogue / people / everything else owned by the business (their
      // grandchildren — staffServices, availability, redemptions — cascade)
      await tx.waitlistEntry.deleteMany(byBiz);
      await tx.clientPackage.deleteMany(byBiz);
      await tx.invoice.deleteMany(byBiz);
      await tx.staffTask.deleteMany(byBiz);
      await tx.giftCard.deleteMany(byBiz);
      await tx.package.deleteMany(byBiz);
      await tx.offer.deleteMany(byBiz);
      await tx.campaign.deleteMany(byBiz);
      await tx.transaction.deleteMany(byBiz);
      await tx.subscription.deleteMany(byBiz);
      await tx.uploadedFile.deleteMany(byBiz);
      await tx.googleCalendarConnection.deleteMany(byBiz);
      await tx.notificationDelivery.deleteMany(byBiz);
      await tx.client.deleteMany(byBiz);
      await tx.service.deleteMany(byBiz);
      await tx.serviceCategory.deleteMany(byBiz);
      await tx.resource.deleteMany(byBiz);
      await tx.location.deleteMany(byBiz);
      await tx.dataErasureRequest.deleteMany(byBiz);
      await tx.privacyConsent.deleteMany(byBiz);
      await tx.staff.deleteMany(byBiz);
      // user-scoped rows for the owner + any staff users in this business
      if (userIds.length) {
        const byUser = { where: { userId: { in: userIds } } };
        await tx.auditLog.deleteMany(byUser);
        await tx.deviceToken.deleteMany(byUser);
        await tx.loginEvent.deleteMany(byUser);
        await tx.notification.deleteMany(byUser);
        await tx.otpChallenge.deleteMany(byUser);
        await tx.refreshSession.deleteMany(byUser);
      }
      await tx.user.deleteMany({ where: { businessId: id } });
      await tx.business.delete({ where: { id } });
    });
    return { deleted: true };
  }

  async update(id: string, dto: UpdateBusinessDto) {
    const current = await this.findOne(id);
    const { bookingPageSettings, notificationSettings, ...rest } = dto;
    const limited = applyPlanLimits(current.plan, rest);
    const data = {
      ...limited,
      ...(limited.maxAdvanceMinutes !== undefined
        ? { maxAdvanceDays: Math.max(1, Math.ceil(limited.maxAdvanceMinutes / 1440)) }
        : {}),
      ...(limited.cancellationWindowMinutes !== undefined
        ? { cancellationWindowHours: Math.floor(limited.cancellationWindowMinutes / 60) }
        : {}),
    };
    return this.prisma.business.update({
      where: { id },
      data: {
        ...data,
        ...(bookingPageSettings !== undefined
          ? { bookingPageSettings: bookingPageSettings as Prisma.InputJsonValue }
          : {}),
        ...(notificationSettings !== undefined
          ? { notificationSettings: notificationSettings as Prisma.InputJsonValue }
          : {}),
      },
    });
  }
}
