import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralsService } from '../referrals/referrals.service';
import { EventsGateway } from '../events/events.gateway';

function makePayment(overrides = {}) {
  return {
    id: 'pay1',
    businessId: 'biz1',
    stripePaymentIntentId: 'pi_123',
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
    refund: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ref1', ...data })) },
    $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PaymentsService,
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('sk_test_x') } },
      { provide: NotificationsService, useValue: {} },
      { provide: ReferralsService, useValue: { recordReferral: jest.fn().mockResolvedValue(false), claimPendingReward: jest.fn().mockResolvedValue(null) } },
      { provide: EventsGateway, useValue: { emitPlanUpdate: jest.fn() } },
    ],
  }).compile();
  const svc = module.get<PaymentsService>(PaymentsService);
  // Inject a fake Stripe so getStripe() returns it without a real key.
  const refundsCreate = jest.fn().mockResolvedValue({ id: 're_1', status: 'succeeded' });
  (svc as unknown as { stripe: unknown }).stripe = { refunds: { create: refundsCreate } };
  return { svc, prisma, refundsCreate };
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
    const { svc, refundsCreate } = await build(makePayment({ refundedCents: 1000 }));
    const res = await svc.refundPayment('biz1', 'pay1', {});
    expect(refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4000 }),
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^pulse:/) }),
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

describe('PaymentsService.handleWebhook', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('fails closed in production when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    process.env.NODE_ENV = 'production';
    const { svc } = await build(makePayment());

    await expect(svc.handleWebhook(Buffer.from('{}'), 'sig_test')).rejects.toThrow(ServiceUnavailableException);
  });

  it('skips unconfigured webhooks outside production', async () => {
    process.env.NODE_ENV = 'development';
    const { svc } = await build(makePayment());

    await expect(svc.handleWebhook(Buffer.from('{}'), 'sig_test')).resolves.toMatchObject({
      received: true,
      skipped: expect.stringContaining('not configured'),
    });
  });
});

describe('PaymentsService subscriptions', () => {
  async function buildSub(env: Record<string, string | undefined>) {
    const prisma = {
      business: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'biz1', name: 'Biz', email: 'b@x.com' }),
        findUnique: jest.fn().mockResolvedValue({ plan: 'FREE' }),
        update: jest.fn().mockResolvedValue({}),
      },
      subscription: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockImplementation((k: string) => env[k]) } },
        { provide: NotificationsService, useValue: { sendPlanChanged: jest.fn().mockResolvedValue(undefined) } },
      { provide: ReferralsService, useValue: { recordReferral: jest.fn().mockResolvedValue(false), claimPendingReward: jest.fn().mockResolvedValue(null) } },
      { provide: EventsGateway, useValue: { emitPlanUpdate: jest.fn() } },
      ],
    }).compile();
    const svc = module.get<PaymentsService>(PaymentsService);
    const stripe = {
      customers: { create: jest.fn().mockResolvedValue({ id: 'cus_1' }) },
      checkout: { sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://stripe.test/checkout' }),
        retrieve: jest.fn().mockResolvedValue({
          mode: 'subscription', status: 'complete', subscription: 'sub_1', metadata: { businessId: 'biz1' },
        }),
      } },
      subscriptions: { retrieve: jest.fn().mockResolvedValue({
        id: 'sub_1', status: 'active', customer: 'cus_1', cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        items: { data: [{ price: { id: 'price_basic_123' } }] },
      }) },
    };
    (svc as unknown as { stripe: unknown }).stripe = stripe;
    return { svc, stripe };
  }

  it('rejects checkout when the plan price is not configured', async () => {
    const { svc } = await buildSub({});
    await expect(svc.createSubscriptionCheckout('biz1', 'BASIC')).rejects.toThrow(BadRequestException);
  });

  it('creates a checkout session when the plan price is configured', async () => {
    const { svc, stripe } = await buildSub({ STRIPE_PRICE_BASIC: 'price_basic_123', STRIPE_CURRENCY: 'CAD' });
    await expect(svc.createSubscriptionCheckout('biz1', 'BASIC')).resolves.toEqual({ url: 'https://stripe.test/checkout' });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'cad',
        line_items: [{ price: 'price_basic_123', quantity: 1 }],
        success_url: expect.stringContaining('session_id={CHECKOUT_SESSION_ID}'),
      }),
      expect.any(Object),
    );
  });

  it('confirms a completed checkout and activates the paid plan immediately', async () => {
    const { svc } = await buildSub({ STRIPE_PRICE_BASIC: 'price_basic_123' });
    await expect(svc.confirmSubscriptionCheckout('biz1', 'cs_1')).resolves.toMatchObject({
      confirmed: true,
      plan: 'BASIC',
      status: 'ACTIVE',
    });
  });

  it('rejects a checkout session belonging to another business', async () => {
    const { svc, stripe } = await buildSub({ STRIPE_PRICE_BASIC: 'price_basic_123' });
    stripe.checkout.sessions.retrieve.mockResolvedValueOnce({
      mode: 'subscription', status: 'complete', subscription: 'sub_1', metadata: { businessId: 'other' },
    });
    await expect(svc.confirmSubscriptionCheckout('biz1', 'cs_other')).rejects.toThrow(BadRequestException);
  });
});
