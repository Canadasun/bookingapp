import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GiftCardsService } from './gift-cards.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const BIZ = 'biz1';

function makeCard(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'gc1', businessId: BIZ, code: 'GIFT-ABCD-EFGH',
    initialCents: 5000, balanceCents: 5000,
    recipientEmail: null, status: 'ACTIVE', expiresAt: null,
    ...over,
  };
}

function build(prismaOver: Record<string, unknown> = {}) {
  const prisma: Record<string, any> = {
    giftCard: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    giftCardRedemption: { create: jest.fn() },
    appointment: { findFirst: jest.fn() },
    ...prismaOver,
  };
  prisma.$transaction = jest.fn().mockImplementation((operation: unknown) =>
    typeof operation === 'function' ? operation(prisma) : Promise.all(operation as Promise<unknown>[]),
  );
  const notifications = { sendGiftCardIssued: jest.fn().mockResolvedValue(undefined) };
  return { prisma, notifications };
}

async function svcWith(prisma: Record<string, unknown>, notifications: Record<string, unknown>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      GiftCardsService,
      { provide: PrismaService, useValue: prisma },
      { provide: NotificationsService, useValue: notifications },
    ],
  }).compile();
  return module.get(GiftCardsService);
}

describe('GiftCardsService.redeem', () => {
  it('decrements balance and logs a redemption', async () => {
    const { prisma, notifications } = build();
    (prisma.giftCard.findFirst as jest.Mock).mockResolvedValue(makeCard());
    (prisma.giftCard.update as jest.Mock).mockResolvedValue(makeCard({ balanceCents: 3000 }));
    (prisma.giftCardRedemption.create as jest.Mock).mockResolvedValue({});
    const svc = await svcWith(prisma, notifications);

    const res = await svc.redeem(BIZ, { code: 'gift-abcd-efgh', amountCents: 2000 });

    expect(res).toEqual({ redeemedCents: 2000, balanceCents: 3000, status: 'ACTIVE' });
    expect(prisma.giftCard.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { balanceCents: 3000, status: 'ACTIVE' } }),
    );
  });

  it('marks the card REDEEMED when drained to zero', async () => {
    const { prisma, notifications } = build();
    (prisma.giftCard.findFirst as jest.Mock).mockResolvedValue(makeCard({ balanceCents: 2000 }));
    (prisma.giftCard.update as jest.Mock).mockResolvedValue(makeCard({ balanceCents: 0, status: 'REDEEMED' }));
    (prisma.giftCardRedemption.create as jest.Mock).mockResolvedValue({});
    const svc = await svcWith(prisma, notifications);

    const res = await svc.redeem(BIZ, { code: 'GIFT-ABCD-EFGH', amountCents: 2000 });

    expect(res.status).toBe('REDEEMED');
    expect(prisma.giftCard.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { balanceCents: 0, status: 'REDEEMED' } }),
    );
  });

  it('rejects redeeming more than the balance', async () => {
    const { prisma, notifications } = build();
    (prisma.giftCard.findFirst as jest.Mock).mockResolvedValue(makeCard({ balanceCents: 1000 }));
    const svc = await svcWith(prisma, notifications);
    await expect(svc.redeem(BIZ, { code: 'x', amountCents: 2000 })).rejects.toThrow(BadRequestException);
  });

  it('rejects a voided card', async () => {
    const { prisma, notifications } = build();
    (prisma.giftCard.findFirst as jest.Mock).mockResolvedValue(makeCard({ status: 'VOID' }));
    const svc = await svcWith(prisma, notifications);
    await expect(svc.redeem(BIZ, { code: 'x', amountCents: 100 })).rejects.toThrow(BadRequestException);
  });

  it('rejects an expired card', async () => {
    const { prisma, notifications } = build();
    (prisma.giftCard.findFirst as jest.Mock).mockResolvedValue(makeCard({ expiresAt: new Date('2020-01-01') }));
    const svc = await svcWith(prisma, notifications);
    await expect(svc.redeem(BIZ, { code: 'x', amountCents: 100 })).rejects.toThrow(BadRequestException);
  });

  it('throws NotFound for an unknown code', async () => {
    const { prisma, notifications } = build();
    (prisma.giftCard.findFirst as jest.Mock).mockResolvedValue(null);
    const svc = await svcWith(prisma, notifications);
    await expect(svc.redeem(BIZ, { code: 'nope', amountCents: 100 })).rejects.toThrow(NotFoundException);
  });

  it('rejects a redemption linked to another tenant appointment', async () => {
    const { prisma, notifications } = build();
    (prisma.giftCard.findFirst as jest.Mock).mockResolvedValue(makeCard());
    (prisma.appointment.findFirst as jest.Mock).mockResolvedValue(null);
    const svc = await svcWith(prisma, notifications);

    await expect(svc.redeem(BIZ, { code: 'x', amountCents: 100, appointmentId: 'foreign' }))
      .rejects.toThrow(NotFoundException);
    expect(prisma.giftCardRedemption.create as jest.Mock).not.toHaveBeenCalled();
  });
});

describe('GiftCardsService.issue', () => {
  it('generates a GIFT code, sets balance to the amount, and emails when a recipient is given', async () => {
    const { prisma, notifications } = build();
    (prisma.giftCard.findFirst as jest.Mock).mockResolvedValue(null); // no code collision
    (prisma.giftCard.create as jest.Mock).mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'gc1', ...data }),
    );
    const svc = await svcWith(prisma, notifications);

    const card = await svc.issue(BIZ, { amountCents: 5000, recipientEmail: 'a@b.com' });

    expect(card.code).toMatch(/^GIFT-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(card.balanceCents).toBe(5000);
    expect(card.initialCents).toBe(5000);
    expect(notifications.sendGiftCardIssued as jest.Mock).toHaveBeenCalledWith('gc1');
  });

  it('does not email when no recipient email is provided', async () => {
    const { prisma, notifications } = build();
    (prisma.giftCard.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.giftCard.create as jest.Mock).mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'gc1', ...data }),
    );
    const svc = await svcWith(prisma, notifications);

    await svc.issue(BIZ, { amountCents: 2500 });

    expect(notifications.sendGiftCardIssued as jest.Mock).not.toHaveBeenCalled();
  });
});
