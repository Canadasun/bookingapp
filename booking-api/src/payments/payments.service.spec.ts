import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralsService } from '../referrals/referrals.service';
import { SquareService } from '../square/square.service';

function makePayment(overrides = {}) {
  return {
    id: 'pay1',
    businessId: 'biz1',
    squarePaymentId: 'sqpay_123',
    amountCents: 5000,
    refundedCents: 0,
    status: 'SUCCEEDED',
    ...overrides,
  };
}

async function build(paymentRow: unknown) {
  const prisma = {
    payment: {
      findFirst: jest.fn().mockResolvedValue(paymentRow),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...makePayment(), ...data })),
    },
    business: { findUniqueOrThrow: jest.fn().mockResolvedValue({ currency: 'CAD' }) },
    refund: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ref1', ...data })) },
    $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  // Square refunds: merchantFetch(POST /v2/refunds) → a completed refund.
  const merchantFetch = jest.fn().mockResolvedValue({ refund: { id: 'sqr_1', status: 'COMPLETED' } });
  const square = {
    merchantFetch,
    locationId: jest.fn().mockResolvedValue('LOC1'),
    status: jest.fn().mockResolvedValue({ connected: true }),
    requireConnection: jest.fn(),
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PaymentsService,
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('sk_test_x') } },
      { provide: NotificationsService, useValue: {} },
      { provide: ReferralsService, useValue: { recordReferral: jest.fn().mockResolvedValue(false), claimPendingReward: jest.fn().mockResolvedValue(null) } },
      { provide: SquareService, useValue: square },
    ],
  }).compile();
  const svc = module.get<PaymentsService>(PaymentsService);
  return { svc, prisma, merchantFetch };
}

describe('PaymentsService.refundPayment', () => {
  it('partial refund → PARTIALLY_REFUNDED with running total', async () => {
    const { svc, prisma } = await build(makePayment());
    const res = await svc.refundPayment('biz1', 'pay1', { amountCents: 2000 });
    expect(res.status).toBe('PARTIALLY_REFUNDED');
    expect(res.refundedCents).toBe(2000);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { refundedCents: 2000, status: 'PARTIALLY_REFUNDED' } }),
    );
  });

  it('full refund (no amount) → REFUNDED of the remaining balance', async () => {
    const { svc, merchantFetch } = await build(makePayment({ refundedCents: 1000 }));
    const res = await svc.refundPayment('biz1', 'pay1', {});
    expect(merchantFetch).toHaveBeenCalledWith(
      'biz1', 'POST', '/v2/refunds',
      expect.objectContaining({ payment_id: 'sqpay_123', amount_money: { amount: 4000, currency: 'CAD' } }),
    ); // 5000 - 1000
    expect(res.status).toBe('REFUNDED');
    expect(res.refundedCents).toBe(5000);
  });

  it('rejects refunding more than the remaining balance', async () => {
    const { svc } = await build(makePayment({ refundedCents: 4000 }));
    await expect(svc.refundPayment('biz1', 'pay1', { amountCents: 2000 })).rejects.toThrow(BadRequestException);
  });

  it('rejects refunding a non-settled payment', async () => {
    const { svc } = await build(makePayment({ status: 'PENDING' }));
    await expect(svc.refundPayment('biz1', 'pay1', {})).rejects.toThrow(BadRequestException);
  });

  it('404 when the payment is not in the business', async () => {
    const { svc } = await build(null);
    await expect(svc.refundPayment('biz1', 'missing', {})).rejects.toThrow(NotFoundException);
  });
});

describe('PaymentsService.subscribeToPlan (Square)', () => {
  async function buildSub(env: Record<string, string | undefined>) {
    const prisma = {
      business: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'biz1', name: 'Biz', email: 'b@x.com' }),
        findUnique: jest.fn().mockResolvedValue({ plan: 'FREE' }),
        update: jest.fn().mockResolvedValue({}),
      },
      subscription: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
    };
    const platformFetch = jest.fn().mockImplementation((_m: string, path: string) => {
      if (path === '/v2/customers') return Promise.resolve({ customer: { id: 'cust_1' } });
      if (path === '/v2/cards') return Promise.resolve({ card: { id: 'card_1' } });
      if (path === '/v2/subscriptions') return Promise.resolve({ subscription: { id: 'sub_1', status: 'ACTIVE', plan_variation_id: env.SQUARE_PLAN_BASIC, customer_id: 'cust_1' } });
      return Promise.resolve({});
    });
    const square = { platformFetch, platformLocationId: jest.fn().mockReturnValue('LOC_PLATFORM'), merchantFetch: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockImplementation((k: string) => env[k]) } },
        { provide: NotificationsService, useValue: { sendPlanChanged: jest.fn().mockResolvedValue(undefined) } },
        { provide: ReferralsService, useValue: { recordReferral: jest.fn().mockResolvedValue(false), claimPendingReward: jest.fn().mockResolvedValue(null) } },
        { provide: SquareService, useValue: square },
      ],
    }).compile();
    return { svc: module.get<PaymentsService>(PaymentsService), platformFetch };
  }

  it('rejects when the plan variation is not configured', async () => {
    const { svc } = await buildSub({});
    await expect(svc.subscribeToPlan('biz1', 'BASIC', 'cnon_token')).rejects.toThrow(BadRequestException);
  });

  it('creates a Square subscription when the plan variation is configured', async () => {
    const { svc, platformFetch } = await buildSub({ SQUARE_PLAN_BASIC: 'planvar_basic' });
    const res = await svc.subscribeToPlan('biz1', 'BASIC', 'cnon_token');
    expect(res).toEqual({ created: true, plan: 'BASIC' });
    expect(platformFetch).toHaveBeenCalledWith(
      'POST', '/v2/subscriptions',
      expect.objectContaining({ plan_variation_id: 'planvar_basic', customer_id: 'cust_1', card_id: 'card_1' }),
    );
  });
});
