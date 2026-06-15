import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitReviewDto } from './dto/reviews.dto';
import { verifyAppointmentToken } from '../common/util/appointment-token';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  // Public — client submits via the post-visit email link (tied to their appt).
  async submit(businessId: string, dto: SubmitReviewDto) {
    // The signed token in the review-request email proves the submitter is the
    // appointment's client (the only recipient of that link).
    if (!verifyAppointmentToken(dto.appointmentId, dto.token)) {
      throw new BadRequestException('Invalid or expired review link');
    }
    const apt = await this.prisma.appointment.findFirst({
      where: { id: dto.appointmentId, businessId },
      include: { client: true },
    });
    if (!apt) throw new NotFoundException('Appointment not found');
    // Reviews are only for visits that actually happened.
    if (apt.status !== 'COMPLETED') {
      throw new BadRequestException('You can only review a completed appointment');
    }
    return this.prisma.review.upsert({
      where: { appointmentId: dto.appointmentId },
      update: { rating: dto.rating, comment: dto.comment },
      create: {
        businessId,
        appointmentId: dto.appointmentId,
        staffId: apt.staffId,
        clientName: apt.client.name,
        rating: dto.rating,
        comment: dto.comment,
      },
    });
  }

  // Public — published reviews + aggregate rating (booking-page social proof).
  async publicList(businessId: string) {
    const [reviews, agg] = await Promise.all([
      this.prisma.review.findMany({
        where: { businessId, published: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, clientName: true, rating: true, comment: true, createdAt: true },
      }),
      this.prisma.review.aggregate({ where: { businessId, published: true }, _avg: { rating: true }, _count: true }),
    ]);
    return { reviews, average: Number((agg._avg.rating ?? 0).toFixed(2)), count: agg._count };
  }

  // Owner — all reviews (incl. hidden).
  ownerList(businessId: string) {
    return this.prisma.review.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async setPublished(businessId: string, id: string, published: boolean) {
    const r = await this.prisma.review.findFirst({ where: { id, businessId } });
    if (!r) throw new NotFoundException('Review not found');
    return this.prisma.review.update({ where: { id }, data: { published } });
  }
}
