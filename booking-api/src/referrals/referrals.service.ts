import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReferralsService {
  constructor(private prisma: PrismaService) {}

  private genCode(): string {
    return 'PULSE-' + randomBytes(3).toString('hex').toUpperCase(); // e.g. PULSE-A3F9C2
  }

  // Lazily assign + return a business's shareable referral code.
  async getOrCreateCode(businessId: string): Promise<string> {
    const biz = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { referralCode: true },
    });
    if (biz.referralCode) return biz.referralCode;
    for (let i = 0; i < 5; i++) {
      const code = this.genCode();
      try {
        await this.prisma.business.update({ where: { id: businessId }, data: { referralCode: code } });
        return code;
      } catch { /* unique collision — retry with a new code */ }
    }
    throw new Error('Could not generate a referral code');
  }

  // The business that owns a code (or null). Never matches the caller's own code.
  async findReferrer(code: string, excludeBusinessId: string): Promise<{ id: string } | null> {
    const c = code.trim().toUpperCase();
    if (!c) return null;
    const biz = await this.prisma.business.findUnique({ where: { referralCode: c }, select: { id: true } });
    if (!biz || biz.id === excludeBusinessId) return null;
    return biz;
  }

  // Record a referral (idempotent — at most one per referred business). Returns
  // true only when a NEW, valid referral was recorded (used to grant the discount).
  async recordReferral(referredBusinessId: string, code: string): Promise<boolean> {
    const referrer = await this.findReferrer(code, referredBusinessId);
    if (!referrer) return false;
    const existing = await this.prisma.referral.findUnique({ where: { referredBusinessId } });
    if (existing) return false;
    try {
      await this.prisma.referral.create({
        data: { code: code.trim().toUpperCase(), referrerBusinessId: referrer.id, referredBusinessId },
      });
      return true;
    } catch {
      return false; // raced — already recorded
    }
  }

  // The dashboard view: my code + who I've referred.
  async getMyReferrals(businessId: string) {
    const code = await this.getOrCreateCode(businessId);
    const referrals = await this.prisma.referral.findMany({
      where: { referrerBusinessId: businessId },
      orderBy: { createdAt: 'desc' },
      include: { referred: { select: { name: true } } },
    });
    return {
      code,
      referredCount: referrals.length,
      referrals: referrals.map((r) => ({ business: r.referred.name, since: r.createdAt, status: r.status })),
    };
  }
}
