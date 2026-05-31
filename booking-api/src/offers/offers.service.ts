import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OffersService {
  constructor(private prisma: PrismaService) {}

  list(businessId: string) {
    return this.prisma.offer.findMany({
      where: { businessId, active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(businessId: string, dto: any) {
    return this.prisma.offer.create({ data: { ...dto, businessId } });
  }

  async update(businessId: string, id: string, dto: any) {
    // Scope by businessId so an offer from another business can't be edited by id.
    const offer = await this.prisma.offer.findFirst({ where: { id, businessId } });
    if (!offer) throw new NotFoundException('Offer not found');
    return this.prisma.offer.update({ where: { id }, data: dto });
  }

  async remove(businessId: string, id: string) {
    const offer = await this.prisma.offer.findFirst({ where: { id, businessId } });
    if (!offer) throw new NotFoundException('Offer not found');
    return this.prisma.offer.delete({ where: { id } });
  }
}
