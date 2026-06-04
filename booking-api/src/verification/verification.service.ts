import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VerificationService {
  constructor(private prisma: PrismaService) {}

  // Owner submits a registration document → status PENDING (awaiting admin).
  async submit(businessId: string, docUrl: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { verificationStatus: true },
    });
    if (!biz) throw new NotFoundException('Business not found');
    if (biz.verificationStatus === 'VERIFIED') {
      throw new BadRequestException('This business is already verified.');
    }
    return this.prisma.business.update({
      where: { id: businessId },
      data: {
        verificationStatus: 'PENDING',
        verificationDocUrl: docUrl,
        verificationNote: null,
        verificationSubmittedAt: new Date(),
      },
      select: { verificationStatus: true, verificationSubmittedAt: true },
    });
  }

  async status(businessId: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        verificationStatus: true,
        verificationDocUrl: true,
        verificationNote: true,
        verificationSubmittedAt: true,
        verifiedAt: true,
      },
    });
    if (!biz) throw new NotFoundException('Business not found');
    return biz;
  }

  // ── Admin review ──────────────────────────────────────────────────────────
  async listPending() {
    return this.prisma.business.findMany({
      where: { verificationStatus: 'PENDING' },
      orderBy: { verificationSubmittedAt: 'asc' },
      select: {
        id: true, name: true, email: true, slug: true,
        verificationDocUrl: true, verificationSubmittedAt: true,
      },
    });
  }

  async approve(businessId: string) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
    if (!biz) throw new NotFoundException('Business not found');
    return this.prisma.business.update({
      where: { id: businessId },
      data: { verificationStatus: 'VERIFIED', verifiedAt: new Date(), verificationNote: null },
      select: { verificationStatus: true, verifiedAt: true },
    });
  }

  async reject(businessId: string, note?: string) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
    if (!biz) throw new NotFoundException('Business not found');
    return this.prisma.business.update({
      where: { id: businessId },
      data: { verificationStatus: 'REJECTED', verificationNote: note?.trim() || 'Document could not be verified.' },
      select: { verificationStatus: true, verificationNote: true },
    });
  }
}
