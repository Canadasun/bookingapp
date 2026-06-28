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
  let currentPayment = paymentRow as ReturnType<typeof makePayment> | null;
  const prisma = {
    payment: {
      findFirst: jest.fn().mockResolvedValue(paymentRow),
      findUnique: jest.fn().mockResolvedValue(paymentRow),
      findUniqueOrThrow: jest.fn().mockImplementation(() => Promise.resolve(currentPayment)),
      update: jest.fn().mockImplementation(({ data }) => {
        if (!currentPayment) throw new Error('payment missing');
        const increment = typeof data.refundedCents === 'object' ? data.refundedCents.increment : undefined;
        currentPayment = {
          ...currentPayment,
          ...data,
          ...(increment !== undefined ? { refundedCents: currentPayment.refundedCents + increment } : {}),
        };
        return Promise.resolve(currentPayment);
      }),
    },
    refund: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ref1', ...data })),
      upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'ref1', ...create })),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 1000 } }),
    },
    $transaction: jest.fn().mockImplementation((operation: any) =>
      typeof operation === 'function' ? operation(prisma) : Promise.all(operation),
    ),
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
      expect.objectContaining({ data: { refundedCents: { increment: 2000 } } }),
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

  it('records a pending refund without changing settled payment totals', async () => {
    const { svc, prisma, refundsCreate } = await build(makePayment());
    refundsCreate.mockResolvedValue({ id: 're_pending', status: 'pending' });

    const result = await svc.refundPayment('biz1', 'pay1', { amountCents: 1000 });

    expect(result).toMatchObject({ refundedCents: 0, status: 'SUCCEEDED' });
    expect(prisma.payment.update).not.toHaveBeenCalled();
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

describe('PaymentsService refund webhook reconciliation', () => {
  it('reconciles a pending refund when Stripe later marks it succeeded', async () => {
    const { svc, prisma } = await build(makePayment());

    await (svc as any).reconcileStripeRefund({
      id: 're_pending', payment_intent: 'pi_123', amount: 1000,
      status: 'succeeded', reason: null,
    });

    expect(prisma.refund.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { stripeRefundId: 're_pending' },
      update: { status: 'SUCCEEDED' },
    }));
    expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { refundedCents: 1000, status: 'PARTIALLY_REFUNDED' },
    }));
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

  it('creates annual checkout when annual price is configured', async () => {
    const { svc, stripe } = await buildSub({
      STRIPE_PRICE_BASIC: 'price_basic_123',
      STRIPE_PRICE_BASIC_ANNUAL: 'price_basic_annual_123',
      STRIPE_CURRENCY: 'CAD',
    });
    await expect(svc.createSubscriptionCheckout('biz1', 'BASIC', undefined, 'year')).resolves.toEqual({ url: 'https://stripe.test/checkout' });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_basic_annual_123', quantity: 1 }],
        metadata: expect.objectContaining({ billingInterval: 'year' }),
        subscription_data: expect.objectContaining({
          metadata: expect.objectContaining({ billingInterval: 'year' }),
        }),
      }),
      expect.any(Object),
    );
  });

  it('rejects annual checkout when annual price is not configured', async () => {
    const { svc } = await buildSub({ STRIPE_PRICE_BASIC: 'price_basic_123' });
    await expect(svc.createSubscriptionCheckout('biz1', 'BASIC', undefined, 'year')).rejects.toThrow(BadRequestException);
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

describe('PaymentsService client memberships', () => {
  async function buildMembership() {
    const membership = {
      id: 'mem1', businessId: 'biz1', clientId: 'client1', planId: 'plan1',
      status: 'PENDING', stripeSubscriptionId: null, cancelAtPeriodEnd: false,
    };
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({
        id: 'biz1', name: 'Salon', plan: 'PRO', currency: 'CAD',
        stripeConnectAccountId: 'acct_1', stripeConnectOnboarded: true,
      }) },
      client: {
        findFirst: jest.fn().mockResolvedValue({ id: 'client1', businessId: 'biz1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'client1', businessId: 'biz1', name: 'Jane', email: 'jane@example.com',
          phone: null, stripeCustomerId: 'cus_1',
        }),
        update: jest.fn(),
      },
      membershipPlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'plan1', businessId: 'biz1', name: 'Monthly', description: null,
          priceMonthly: 7900, active: true, stripeProductId: null, stripePriceId: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      clientMembership: {
        findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.OR ? null : membership)),
        create: jest.fn().mockResolvedValue(membership),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...membership, ...data })),
        delete: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...membership, status: 'ACTIVE', cancelAtPeriodEnd: true }),
      },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          membershipPlan: {
            findUnique: jest.fn().mockResolvedValue({ stripePriceId: null, stripeProductId: null }),
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockImplementation((key: string) => key === 'NEXT_PUBLIC_WEB_URL' ? 'https://app.test' : 'sk_test_x') } },
        { provide: NotificationsService, useValue: {} },
        { provide: ReferralsService, useValue: {} },
        { provide: EventsGateway, useValue: {} },
      ],
    }).compile();
    const svc = module.get(PaymentsService);
    const subscription = {
      id: 'sub_member', status: 'active', customer: 'cus_1', cancel_at_period_end: false,
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
      metadata: { kind: 'client_membership', businessId: 'biz1', membershipId: 'mem1' },
      items: { data: [{ price: { id: 'price_member' } }] },
    };
    const stripe = {
      products: { create: jest.fn().mockResolvedValue({ id: 'prod_member' }) },
      prices: { create: jest.fn().mockResolvedValue({ id: 'price_member' }) },
      checkout: { sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://checkout.test/member' }),
        retrieve: jest.fn().mockResolvedValue({
          mode: 'subscription', status: 'complete', subscription: 'sub_member',
          metadata: { kind: 'client_membership', businessId: 'biz1', membershipId: 'mem1' },
        }),
      } },
      subscriptions: {
        retrieve: jest.fn().mockResolvedValue(subscription),
        update: jest.fn().mockResolvedValue({ ...subscription, cancel_at_period_end: true }),
      },
    };
    (svc as unknown as { stripe: unknown }).stripe = stripe;
    return { svc, prisma, stripe };
  }

  it('keeps enrollment pending until Stripe checkout succeeds', async () => {
    const { svc, prisma, stripe } = await buildMembership();
    await expect(svc.createClientMembershipCheckout('biz1', 'client1', 'plan1')).resolves.toEqual({
      url: 'https://checkout.test/member', membershipId: 'mem1',
    });
    expect(prisma.clientMembership.create).toHaveBeenCalledWith({
      data: { businessId: 'biz1', clientId: 'client1', planId: 'plan1', status: 'PENDING' },
    });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: expect.objectContaining({ transfer_data: { destination: 'acct_1' } }),
      }),
      expect.any(Object),
    );
  });

  it('activates a membership only after confirming the completed Stripe session', async () => {
    const { svc, prisma } = await buildMembership();
    await expect(svc.confirmClientMembershipCheckout('biz1', 'cs_member')).resolves.toMatchObject({
      confirmed: true, membershipId: 'mem1', status: 'ACTIVE',
    });
    expect(prisma.clientMembership.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'mem1' }, data: expect.objectContaining({ stripeSubscriptionId: 'sub_member', status: 'ACTIVE' }),
    }));
  });
});

describe('PaymentsService.getPlanPaymentLinks', () => {
  async function buildLinks(env: Record<string, string | undefined>) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn().mockImplementation((k: string) => env[k]) } },
        { provide: NotificationsService, useValue: {} },
        { provide: ReferralsService, useValue: {} },
        { provide: EventsGateway, useValue: {} },
      ],
    }).compile();
    const svc = module.get<PaymentsService>(PaymentsService);
    const retrieve = jest.fn().mockImplementation((id: string) =>
      Promise.resolve({ id, active: true, url: `https://buy.stripe.com/${id}` }),
    );
    (svc as unknown as { stripe: unknown }).stripe = { paymentLinks: { retrieve } };
    return { svc, retrieve };
  }

  it('resolves configured plink IDs to their hosted URLs per plan/interval', async () => {
    const { svc, retrieve } = await buildLinks({
      BASIC_MONTHLY_PLAN: 'plink_basic_m',
      BASIC_ANNUAL_SUBSCRIPTION: 'plink_basic_y',
      PRO_MONTHLY_PLAN: 'plink_pro_m',
    });
    const links = await svc.getPlanPaymentLinks();
    expect(links).toEqual({
      BASIC: { month: 'https://buy.stripe.com/plink_basic_m', year: 'https://buy.stripe.com/plink_basic_y' },
      PRO: { month: 'https://buy.stripe.com/plink_pro_m' },
    });
    expect(retrieve).toHaveBeenCalledTimes(3);
  });

  it('skips unset, non-plink, and inactive links without throwing', async () => {
    const { svc } = await buildLinks({ BASIC_MONTHLY_PLAN: 'price_not_a_link', PRO_MONTHLY_PLAN: 'plink_pro_m' });
    (svc as unknown as { stripe: { paymentLinks: { retrieve: jest.Mock } } }).stripe.paymentLinks.retrieve =
      jest.fn().mockResolvedValue({ id: 'plink_pro_m', active: false, url: 'https://buy.stripe.com/x' });
    const links = await svc.getPlanPaymentLinks();
    expect(links).toEqual({});
  });

  it('caches the resolved map so Stripe is not hit twice', async () => {
    const { svc, retrieve } = await buildLinks({ PRO_MONTHLY_PLAN: 'plink_pro_m' });
    await svc.getPlanPaymentLinks();
    await svc.getPlanPaymentLinks();
    expect(retrieve).toHaveBeenCalledTimes(1);
  });
});
