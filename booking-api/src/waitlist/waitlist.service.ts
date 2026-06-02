import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JoinWaitlistDto } from './dto/waitlist.dto';

@Injectable()
export class WaitlistService {
  constructor(private prisma: PrismaService) {}

  join(businessId: string, dto: JoinWaitlistDto) {
    return this.prisma.waitlistEntry.create({
      data: {
        businessId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        serviceId: dto.serviceId,
        staffId: dto.staffId,
        desiredDate: dto.desiredDate ? new Date(dto.desiredDate) : undefined,
        notes: dto.notes,
      },
    });
  }

  list(businessId: string) {
    return this.prisma.waitlistEntry.findMany({
      where: { businessId, status: 'WAITING' },
      orderBy: { createdAt: 'asc' },
      take: 500, // bound the result set
    });
  }

  async remove(businessId: string, id: string) {
    const entry = await this.prisma.waitlistEntry.findFirst({ where: { id, businessId } });
    if (!entry) throw new NotFoundException('Waitlist entry not found');
    // Soft-cancel so history is kept.
    return this.prisma.waitlistEntry.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
