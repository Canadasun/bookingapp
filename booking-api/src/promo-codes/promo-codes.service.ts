import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PromoCodesService {
  constructor(private prisma: PrismaService) {}

  list(businessId: string) {
    return this.prisma.promoCode.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(businessId: string, dto: {
    code: string; discountType: 'PERCENT' | 'FLAT'; discountValue: number;
    maxUsages?: number; expiresAt?: string; active?: boolean;
  }) {
    return this.prisma.promoCode.create({
      data: {
        businessId,
        code: dto.code.toUpperCase().trim(),
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxUsages: dto.maxUsages ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        active: dto.active ?? true,
      },
    });
  }

  async update(businessId: string, id: string, dto: Partial<{
    code: string; discountType: 'PERCENT' | 'FLAT'; discountValue: number;
    maxUsages: number | null; expiresAt: string | null; active: boolean;
  }>) {
    const pc = await this.prisma.promoCode.findFirst({ where: { id, businessId } });
    if (!pc) throw new NotFoundException('Promo code not found');
    const nextType = dto.discountType ?? pc.discountType;
    const nextValue = dto.discountValue ?? pc.discountValue;
    if (nextType === 'PERCENT' && nextValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }
    return this.prisma.promoCode.update({
      where: { id, businessId },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.toUpperCase().trim() } : {}),
        ...(dto.discountType !== undefined ? { discountType: dto.discountType } : {}),
        ...(dto.discountValue !== undefined ? { discountValue: dto.discountValue } : {}),
        ...(dto.maxUsages !== undefined ? { maxUsages: dto.maxUsages } : {}),
        ...(dto.expiresAt !== undefined ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  async remove(businessId: string, id: string) {
    const pc = await this.prisma.promoCode.findFirst({ where: { id, businessId } });
    if (!pc) throw new NotFoundException('Promo code not found');
    return this.prisma.promoCode.delete({ where: { id, businessId } });
  }

  // Called from booking page — validates and returns discount info
  async validate(businessId: string, code: string, priceCents: number) {
    const pc = await this.prisma.promoCode.findFirst({
      where: { businessId, code: code.toUpperCase().trim(), active: true },
    });
    if (!pc) throw new BadRequestException('Invalid or expired promo code');
    if (pc.expiresAt && pc.expiresAt < new Date()) throw new BadRequestException('Invalid or expired promo code');
    if (pc.maxUsages !== null && pc.usageCount >= pc.maxUsages) throw new BadRequestException('Invalid or expired promo code');

    const discountCents = pc.discountType === 'PERCENT'
      ? Math.min(priceCents, Math.round(priceCents * pc.discountValue / 100))
      : Math.min(pc.discountValue, priceCents);

    return { id: pc.id, code: pc.code, discountType: pc.discountType, discountValue: pc.discountValue, discountCents };
  }
}
