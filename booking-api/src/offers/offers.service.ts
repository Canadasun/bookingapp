import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type OfferFields = {
  title: string;
  description: string;
  imageUrl?: string;
  discount?: string;
  expiresAt?: string;
  active?: boolean;
};

@Injectable()
export class OffersService {
  constructor(private prisma: PrismaService) {}

  list(businessId: string) {
    return this.prisma.offer.findMany({
      where: { businessId, active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: 'desc' },
      take: 500, // bound the result set
    });
  }

  create(businessId: string, dto: OfferFields) {
    return this.prisma.offer.create({
      data: {
        businessId,
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        discount: dto.discount,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        active: dto.active ?? true,
      },
    });
  }

  async update(businessId: string, id: string, dto: Partial<OfferFields>) {
    const offer = await this.prisma.offer.findFirst({ where: { id, businessId } });
    if (!offer) throw new NotFoundException('Offer not found');
    return this.prisma.offer.update({
      where: { id, businessId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.discount !== undefined ? { discount: dto.discount } : {}),
        ...(dto.expiresAt !== undefined ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  async remove(businessId: string, id: string) {
    const offer = await this.prisma.offer.findFirst({ where: { id, businessId } });
    if (!offer) throw new NotFoundException('Offer not found');
    return this.prisma.offer.delete({ where: { id, businessId } });
  }
}
