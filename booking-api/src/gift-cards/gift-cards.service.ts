import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IssueGiftCardDto, RedeemGiftCardDto } from './dto/gift-cards.dto';
import { isProPlan } from '../common/util/plan-features';

// Unambiguous alphabet (no 0/O, 1/I) for codes people read off a card.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class GiftCardsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private genCode() {
    // 4 blocks × 4 chars × 5 bits/char (32-symbol alphabet) = 80 bits of entropy.
    const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    return `GIFT-${block()}-${block()}-${block()}-${block()}`;
  }

  async issue(businessId: string, dto: IssueGiftCardDto) {
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { plan: true } });
    if (!isProPlan(business.plan)) throw new ForbiddenException('Gift cards require a Pro or Unlimited plan');
    // Retry on the rare per-business code collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.genCode();
      const exists = await this.prisma.giftCard.findFirst({ where: { businessId, code }, select: { id: true } });
      if (exists) continue;
      const card = await this.prisma.giftCard.create({
        data: {
          businessId,
          code,
          initialCents: dto.amountCents,
          balanceCents: dto.amountCents,
          recipientName: dto.recipientName,
          recipientEmail: dto.recipientEmail,
          purchaserName: dto.purchaserName,
          message: dto.message,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        },
      });
      if (card.recipientEmail) await this.notifications.sendGiftCardIssued(card.id);
      return card;
    }
    throw new ConflictException('Could not generate a unique gift card code, please retry');
  }

  list(businessId: string) {
    return this.prisma.giftCard.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 500, // bound the result set
    });
  }

  async get(businessId: string, id: string) {
    const card = await this.prisma.giftCard.findFirst({
      where: { id, businessId },
      include: { redemptions: { orderBy: { createdAt: 'desc' } } },
    });
    if (!card) throw new NotFoundException('Gift card not found');
    return card;
  }

  // Public balance check — by code, no auth. Returns a safe subset.
  async balance(businessId: string, code: string) {
    const card = await this.prisma.giftCard.findFirst({
      where: { businessId, code: code.trim().toUpperCase() },
    });
    if (!card) throw new NotFoundException('No gift card found for that code');
    return {
      code: card.code,
      balanceCents: card.balanceCents,
      status: card.status,
      expiresAt: card.expiresAt,
    };
  }

  async redeem(businessId: string, dto: RedeemGiftCardDto) {
    const runRedeem = () =>
      this.prisma.$transaction(
        async (tx) => {
          // Re-read inside the transaction — this is the read that Postgres
          // tracks for serialization conflict detection.
          const card = await tx.giftCard.findFirst({
            where: { businessId, code: dto.code.trim().toUpperCase() },
          });
          if (!card) throw new NotFoundException('No gift card found for that code');
          if (card.status === 'VOID') throw new BadRequestException('This gift card has been voided');
          if (card.expiresAt && card.expiresAt < new Date())
            throw new BadRequestException('This gift card has expired');
          if (card.balanceCents <= 0)
            throw new BadRequestException('This gift card has no balance left');
          if (dto.amountCents > card.balanceCents) {
            throw new BadRequestException(
              `Only ${(card.balanceCents / 100).toFixed(2)} remaining on this card`,
            );
          }
          if (dto.appointmentId) {
            const appointment = await tx.appointment.findFirst({
              where: { id: dto.appointmentId, businessId },
              select: { id: true },
            });
            if (!appointment) throw new NotFoundException('Appointment not found');
          }
          const newBalance = card.balanceCents - dto.amountCents;
          await tx.giftCardRedemption.create({
            data: {
              giftCardId: card.id,
              amountCents: dto.amountCents,
              appointmentId: dto.appointmentId,
            },
          });
          return tx.giftCard.update({
            where: { id: card.id, businessId: card.businessId },
            data: { balanceCents: newBalance, status: newBalance === 0 ? 'REDEEMED' : 'ACTIVE' },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    // SERIALIZABLE isolation ensures two concurrent redemptions cannot both
    // read the same balance and both deduct from it. Postgres will abort one
    // with a serialization error (P2034) if the reads/writes conflict.
    let updated: Awaited<ReturnType<typeof runRedeem>>;
    for (let attempt = 0; ; attempt += 1) {
      try {
        updated = await runRedeem();
        break;
      } catch (err) {
        const isWriteConflict = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';
        if (!isWriteConflict || attempt >= 2) throw err;
      }
    }
    return { redeemedCents: dto.amountCents, balanceCents: updated.balanceCents, status: updated.status };
  }

  async void(businessId: string, id: string) {
    await this.get(businessId, id);
    return this.prisma.giftCard.update({ where: { id, businessId }, data: { status: 'VOID' } });
  }
}
