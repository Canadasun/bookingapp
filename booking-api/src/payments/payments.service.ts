import { Injectable, BadRequestException, NotFoundException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentKind, PaymentStatus, PlanTier, SubscriptionStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import Stripe from 'stripe';
import { isPaidPlan, isProPlan } from '../common/util/plan-features';
import { ReferralsService } from '../referrals/referrals.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class PaymentsService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private notifications: NotificationsService,
    private referrals: ReferralsService,
    private events: EventsGateway,
  ) {}

  // Lazily construct Stripe so a missing STRIPE_SECRET_KEY can't crash the app
  // at boot. Only payment paths reach this; if the key is unset they fail with a
  // clear 400 instead of taking down the API.
  private getStripe(): Stripe {
    if (!this.stripe) {
      const key = this.configService.get<string>('STRIPE_SECRET_KEY');
      if (!key) {
        throw new BadRequestException('Payments are not configured: STRIPE_SECRET_KEY is not set.');
      }
      this.stripe = new Stripe(key);
    }
    return this.stripe;
  }

  private async reconcileStripeRefund(stripeRefund: Stripe.Refund) {
    const intentId = typeof stripeRefund.payment_intent === 'string'
      ? stripeRefund.payment_intent
      : stripeRefund.payment_intent?.id;
    if (!intentId) return;
    const payment = await this.prisma.payment.findUnique({ where: { stripePaymentIntentId: intentId } });
    if (!payment) return;
    const refundStatus = stripeRefund.status === 'succeeded' ? 'SUCCEEDED' : stripeRefund.status === 'failed' ? 'FAILED' : 'PENDING';
    await this.prisma.refund.upsert({
      where: { stripeRefundId: stripeRefund.id },
      update: { status: refundStatus },
      create: {
        businessId: payment.businessId,
        paymentId: payment.id,
        stripeRefundId: stripeRefund.id,
        amountCents: stripeRefund.amount,
        reason: stripeRefund.reason ?? undefined,
        status: refundStatus,
      },
    });
    if (refundStatus === 'SUCCEEDED') {
      const successful = await this.prisma.refund.aggregate({
        where: { paymentId: payment.id, status: 'SUCCEEDED' },
        _sum: { amountCents: true },
      });
      const refundedCents = Math.min(successful._sum.amountCents ?? 0, payment.amountCents);
      const status: PaymentStatus = refundedCents >= payment.amountCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await this.prisma.payment.update({ where: { id: payment.id }, data: { refundedCents, status } });
    }
  }

  private publishableKey(): string {
    return this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') ?? '';
  }

  // Currency used for Pulse's own subscription billing and account credits.
  // Client appointment payments use the individual business currency instead.
  private stripeCurrency(): string {
    const currency = (this.configService.get<string>('STRIPE_CURRENCY') ?? 'cad').trim().toLowerCase();
    if (!/^[a-z]{3}$/.test(currency)) {
      throw new BadRequestException('STRIPE_CURRENCY must be a three-letter ISO currency code such as CAD');
    }
    return currency;
  }

  // Stripe currency code (lowercase) for a business; defaults to CAD.
  private currencyOf(b: { currency?: string | null } | null | undefined): string {
    return (b?.currency ?? 'CAD').toLowerCase();
  }

  // Platform fee retained by Pulse on each charge, based on the business's plan.
  // This is deducted from the transfer to the connected account via application_fee_amount.
  private platformFeeCents(plan: string, amountCents: number): number {
    const rates: Record<string, { pct: number; fixed: number }> = {
      FREE:      { pct: 0.026, fixed: 15 },
      BASIC:     { pct: 0.025, fixed: 15 },
      PRO:       { pct: 0.024, fixed: 15 },
      UNLIMITED: { pct: 0.024, fixed: 15 },
    };
    const r = rates[plan] ?? rates.FREE;
    return Math.max(1, Math.round(amountCents * r.pct + r.fixed));
  }

  private platformFeePercent(plan: string): number {
    return plan === 'FREE' ? 2.6 : plan === 'BASIC' ? 2.5 : 2.4;
  }

  // Returns Stripe destination-charge params when the business has an active
  // Connect account, or an empty object so the charge falls through to the platform.
  private connectChargeParams(
    business: { stripeConnectAccountId: string | null; stripeConnectOnboarded: boolean; plan: string },
    amountCents: number,
  ): Record<string, unknown> {
    if (!business.stripeConnectAccountId || !business.stripeConnectOnboarded) return {};
    return {
      application_fee_amount: this.platformFeeCents(business.plan, amountCents),
      transfer_data: { destination: business.stripeConnectAccountId },
    };
  }

  private idempotencyKey(parts: Array<string | number | null | undefined>): string {
    const raw = parts.map((p) => String(p ?? '')).join(':');
    const digest = createHash('sha256').update(raw).digest('hex').slice(0, 32);
    return `pulse:${digest}`;
  }

  // Ledger write. Best-effort: a bookkeeping failure must never break a real
  // charge (the money has already moved), so we log and continue.
  private async recordPayment(data: {
    businessId: string;
    appointmentId?: string | null;
    clientId?: string | null;
    stripePaymentIntentId?: string | null;
    amountCents: number;
    tipCents?: number;
    taxCents?: number;
    kind: PaymentKind;
    status: PaymentStatus;
    description?: string;
  }) {
    try {
      await this.prisma.payment.create({ data });
    } catch (err) {
      this.logger.error(`[ledger] failed to record payment: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Get-or-create a Stripe Customer for a client and persist the id so cards can
  // be saved and re-charged (deposits / no-show protection).
  private async ensureCustomer(clientId: string): Promise<string> {
    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    if (client.stripeCustomerId) return client.stripeCustomerId;
    const customer = await this.getStripe().customers.create({
      name: client.name,
      ...(client.email ? { email: client.email } : {}),
      phone: client.phone ?? undefined,
      metadata: { clientId: client.id, businessId: client.businessId },
    });
    await this.prisma.client.update({ where: { id: clientId }, data: { stripeCustomerId: customer.id } });
    return customer.id;
  }

  /**
   * Create the payment step for a booking, driven by the business settings:
   *  - requireDeposit         → PaymentIntent for depositPercent of the price,
   *                             with the card saved off_session for no-show charges.
   *  - else noShowFeeCents>0  → SetupIntent (card-on-file, no upfront charge).
   *  - else                   → nothing required.
   * Returns the Stripe client secret + publishable key for Stripe.js on the client.
   */
  async createBookingIntent(appointmentId: string) {
    const apt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId },
      include: { service: true, client: true, business: true },
    });
    if (!apt) throw new BadRequestException('Appointment not found');
    if (apt.status !== 'PENDING') throw new BadRequestException('Payment can only be initiated for PENDING appointments');
    const businessId = apt.businessId;

    const b = apt.business;
    // Free never collects money at booking. Basic+ can collect deposits; Pro
    // also supports card-on-file protection for later automatic fees.
    if (!isPaidPlan(b.plan)) return { required: false, mode: 'none' as const };

    const customer = await this.ensureCustomer(apt.clientId);

    if (b.requireDeposit) {
      const totalPriceCents = apt.totalPriceCents || apt.service.priceCents;
      const depositCents = Math.max(50, Math.round(totalPriceCents * (b.depositPercent / 100)));
      const intent = await this.getStripe().paymentIntents.create({
        amount: depositCents,
        currency: this.currencyOf(b),
        customer,
        ...(apt.client.email ? { receipt_email: apt.client.email } : {}),
        ...(isProPlan(b.plan) ? { setup_future_usage: 'off_session' as const } : {}),
        // Card-only: no redirect-based methods, so the client can confirm without
        // supplying a return_url.
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { appointmentId, businessId, kind: 'deposit' },
        description: `Deposit — ${apt.service.name} @ ${b.name}`,
        ...this.connectChargeParams(b, depositCents),
      }, { idempotencyKey: this.idempotencyKey(['deposit', businessId, appointmentId, depositCents]) });
      await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: { stripePaymentIntentId: intent.id, depositCents },
      });
      await this.recordPayment({
        businessId, appointmentId, clientId: apt.clientId,
        stripePaymentIntentId: intent.id, amountCents: depositCents,
        kind: 'DEPOSIT', status: 'PENDING',
        description: `Deposit — ${apt.service.name}`,
      });
      return { required: true, mode: 'payment' as const, clientSecret: intent.client_secret, amountCents: depositCents, publishableKey: this.publishableKey(), currency: b.currency };
    }

    // Card-on-file (no upfront charge): collect a saveable card when the owner
    // turned on "always collect a card", or (Pro) when a no-show fee is set.
    if (b.collectCardOnFile || (isProPlan(b.plan) && b.noShowFeeCents > 0)) {
      const intent = await this.getStripe().setupIntents.create({
        customer,
        usage: 'off_session',
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { appointmentId, businessId, kind: 'card_on_file' },
      }, { idempotencyKey: this.idempotencyKey(['card-on-file', businessId, appointmentId]) });
      return { required: true, mode: 'setup' as const, clientSecret: intent.client_secret, amountCents: 0, publishableKey: this.publishableKey(), currency: b.currency };
    }

    return { required: false, mode: 'none' as const };
  }

  // Owner-initiated deposit (dashboard). businessId comes from the authenticated
  // JWT — verify the appointment belongs to this business before proceeding.
  async createDepositIntent(appointmentId: string, businessId: string) {
    const check = await this.prisma.appointment.findFirst({ where: { id: appointmentId, businessId } });
    if (!check) throw new BadRequestException('Appointment not found');
    return this.createBookingIntent(appointmentId);
  }

  /** Create an in-person PaymentIntent for confirmation in mobile PaymentSheet. */
  async createCustomCharge(
    businessId: string,
    input: { amountCents: number; tipCents?: number; taxCents?: number; description?: string; clientId?: string; idempotencyKey?: string },
  ) {
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    if (!isPaidPlan(business.plan)) {
      throw new BadRequestException('Manual charges require Basic or Pro.');
    }
    const chargeClient = input.clientId
      ? await this.prisma.client.findFirst({
          where: { id: input.clientId, businessId },
          select: { email: true },
        })
      : null;
    if (input.clientId && !chargeClient) throw new BadRequestException('Client not found');
    const intent = await this.getStripe().paymentIntents.create({
      amount: input.amountCents,
      currency: this.currencyOf(business),
      ...(chargeClient?.email ? { receipt_email: chargeClient.email } : {}),
      // Card-only, no redirect methods; PaymentSheet confirms on-device.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        businessId,
        kind: 'mobile_card',
        ...(input.clientId ? { clientId: input.clientId } : {}),
      },
      description: input.description?.trim() || `In-person charge — ${business.name}`,
      ...this.connectChargeParams(business, input.amountCents),
    }, {
      idempotencyKey: input.idempotencyKey?.trim()
        ? this.idempotencyKey(['custom', businessId, input.idempotencyKey.trim()])
        : this.idempotencyKey([
          'custom',
          businessId,
          randomUUID(),
        ]),
    });
    await this.recordPayment({
      businessId, clientId: input.clientId ?? null,
      stripePaymentIntentId: intent.id, amountCents: input.amountCents,
      tipCents: input.tipCents ?? 0, taxCents: input.taxCents ?? 0,
      kind: 'IN_PERSON', status: 'PENDING',
      description: input.description?.trim() || `In-person charge`,
    });
    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amountCents: input.amountCents,
      currency: this.currencyOf(business),
      status: intent.status,
      publishableKey: this.publishableKey(),
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    // Collect all configured webhook secrets. Supports multiple registered endpoints
    // (e.g. one account webhook + one Connect webhook) each with their own signing secret.
    // Env var names: STRIPE_WEBHOOK_SECRET (primary), STRIPE_CONNECT_WEBHOOK_SECRET,
    // STRIPE_SNAPSHOT_WH, STRIPE_SNAPSHOT_WH_TWO (legacy/alternate names).
    const candidateSecrets = [
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET'),
      this.configService.get<string>('STRIPE_CONNECT_WEBHOOK_SECRET'),
      this.configService.get<string>('STRIPE_SNAPSHOT_WH'),
      this.configService.get<string>('STRIPE_SNAPSHOT_WH_TWO'),
    ].filter((s): s is string => typeof s === 'string' && s.startsWith('whsec_'));

    if (candidateSecrets.length === 0) {
      // In production, fail CLOSED and loudly: a missing/invalid secret means the
      // webhook is misconfigured (deposits won't auto-confirm) — surface it as an
      // error so Stripe flags failed deliveries and the operator notices, rather
      // than silently 200-ing. Outside production, no-op so local/dev works.
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Stripe webhook secret is not configured');
      }
      return { received: true, skipped: 'stripe webhook deferred — not configured' };
    }

    // Try each secret in order — the one that signed this request will succeed.
    let event: Stripe.Event | null = null;
    const stripe = this.getStripe();
    for (const secret of candidateSecrets) {
      try { event = stripe.webhooks.constructEvent(rawBody, signature, secret); break; } catch { /* try next */ }
    }
    if (!event) {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        // Grab the Stripe-hosted receipt URL from the settled charge so it can be
        // surfaced in the dashboard (best-effort — never block the webhook).
        let receiptUrl: string | null = null;
        const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id;
        if (chargeId) {
          try {
            const charge = await this.getStripe().charges.retrieve(chargeId);
            receiptUrl = charge.receipt_url ?? null;
          } catch { /* receipt is a nice-to-have */ }
        }
        // Ledger: mark the payment SUCCEEDED (idempotent — keyed on the unique
        // intent id; only flips rows not already settled).
        await this.prisma.payment.updateMany({
          where: { stripePaymentIntentId: intent.id, status: { in: ['PENDING', 'FAILED'] } },
          data: { status: 'SUCCEEDED', ...(receiptUrl ? { receiptUrl } : {}) },
        });
        const appointmentId = intent.metadata.appointmentId;
        if (appointmentId) {
          // Idempotent: only transition (and notify) on first success.
          const { count } = await this.prisma.appointment.updateMany({
            where: { id: appointmentId, stripePaymentIntentId: intent.id, status: { not: 'CONFIRMED' } },
            data: {
              status: 'CONFIRMED',
              // Persist the saved card for a possible no-show charge later.
              ...(typeof intent.payment_method === 'string' ? { stripePaymentMethodId: intent.payment_method } : {}),
            },
          });
          if (count > 0) {
            const apt = await this.prisma.appointment.findUnique({
              where: { id: appointmentId },
              include: { client: true, service: true, staff: { include: { user: true } }, business: true },
            });
            if (apt) await this.notifications.scheduleReminders(apt);
          }
        }
        break;
      }
      case 'setup_intent.succeeded': {
        // Card-on-file (no deposit): save the payment method for no-show charges.
        const si = event.data.object as Stripe.SetupIntent;
        const appointmentId = si.metadata?.appointmentId;
        if (appointmentId && typeof si.payment_method === 'string') {
          await this.prisma.appointment.updateMany({
            where: { id: appointmentId },
            data: { stripePaymentMethodId: si.payment_method },
          });
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await this.prisma.payment.updateMany({
          where: { stripePaymentIntentId: intent.id, status: 'PENDING' },
          data: { status: 'FAILED' },
        });
        const appointmentId = intent.metadata.appointmentId;
        if (appointmentId) {
          const { count } = await this.prisma.appointment.updateMany({
            where: { id: appointmentId, stripePaymentIntentId: intent.id, status: 'PENDING' },
            data: { status: 'CANCELLED' },
          });
          if (count > 0) await this.notifications.sendDepositFailed(appointmentId).catch(() => {});
        }
        break;
      }
      case 'charge.refunded': {
        // Reconcile the ledger when a refund happens anywhere (our endpoint, the
        // Stripe dashboard, or a dispute). Keyed on the payment intent.
        const charge = event.data.object as Stripe.Charge;
        const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
        if (intentId) {
          const payment = await this.prisma.payment.findUnique({ where: { stripePaymentIntentId: intentId } });
          if (payment) {
            const refundedCents = charge.amount_refunded ?? 0;
            const status: PaymentStatus =
              refundedCents >= payment.amountCents ? 'REFUNDED' : refundedCents > 0 ? 'PARTIALLY_REFUNDED' : payment.status;
            await this.prisma.payment.update({ where: { id: payment.id }, data: { refundedCents, status } });
            // Mirror each Stripe refund as a Refund row (idempotent on stripeRefundId).
            for (const r of charge.refunds?.data ?? []) {
              await this.prisma.refund.upsert({
                where: { stripeRefundId: r.id },
                update: { status: r.status === 'succeeded' ? 'SUCCEEDED' : r.status === 'failed' ? 'FAILED' : 'PENDING' },
                create: {
                  businessId: payment.businessId, paymentId: payment.id, stripeRefundId: r.id,
                  amountCents: r.amount, reason: r.reason ?? undefined,
                  status: r.status === 'succeeded' ? 'SUCCEEDED' : r.status === 'failed' ? 'FAILED' : 'PENDING',
                },
              });
            }
          }
        }
        break;
      }
      case 'refund.updated':
      case 'refund.failed':
      case 'charge.refund.updated': {
        await this.reconcileStripeRefund(event.data.object as Stripe.Refund);
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          const businessId = session.metadata?.businessId;
          const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          if (businessId) {
            const sub = await this.getStripe().subscriptions.retrieve(subId);
            if (session.metadata?.kind === 'client_membership') {
              await this.applyClientMembership(businessId, session.metadata.membershipId, sub);
            } else {
              await this.applySubscription(businessId, sub);
            }
          }
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const businessId = sub.metadata?.businessId;
        if (businessId) {
          if (sub.metadata?.kind === 'client_membership') {
            await this.applyClientMembership(businessId, sub.metadata.membershipId, sub);
          } else {
            await this.applySubscription(businessId, sub);
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const businessId = sub.metadata?.businessId;
        // Route through applySubscription so the plan-changed email and WebSocket
        // event fire automatically (status 'canceled' maps effectivePlan → FREE).
        if (businessId) {
          if (sub.metadata?.kind === 'client_membership') {
            await this.applyClientMembership(businessId, sub.metadata.membershipId, sub);
          } else {
            await this.applySubscription(businessId, sub);
          }
        }
        break;
      }
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        // details_submitted = owner finished the onboarding form.
        // charges_enabled   = Stripe approved KYC; the account can now accept payments.
        // payouts_enabled    = Stripe approved payouts to the linked bank account.
        if (account.details_submitted) {
          const biz = await this.prisma.business.findFirst({
            where: { stripeConnectAccountId: account.id },
            select: { id: true, stripeConnectOnboarded: true },
          });
          if (biz) {
            await this.prisma.business.update({
              where: { id: biz.id },
              data: { stripeConnectOnboarded: true },
            });
            // Notify the owner the first time their account is fully approved.
            if (!biz.stripeConnectOnboarded && account.charges_enabled) {
              await this.prisma.systemError?.create?.({
                data: {
                  businessId: biz.id,
                  category: 'PAYMENT',
                  severity: 'INFO',
                  message: 'Your Stripe account has been verified. You can now accept deposits and card payments from clients.',
                  context: { accountId: account.id, chargesEnabled: true },
                },
              }).catch(() => {});
              await this.notifications.sendConnectApproved(biz.id).catch(() => {});
            }
            // Surface unresolved requirements so the owner knows to take action.
            const pastDue = account.requirements?.past_due ?? [];
            if (pastDue.length > 0) {
              this.logger.warn(`Stripe account ${account.id} has ${pastDue.length} past_due requirement(s)`);
              await this.prisma.systemError?.create?.({
                data: {
                  businessId: biz.id,
                  category: 'PAYMENT',
                  severity: 'WARN',
                  message: 'Stripe needs more information to keep your account active. Go to your Stripe dashboard to complete the required steps.',
                  context: { accountId: account.id, pastDue },
                },
              }).catch(() => {});
            }
          }
        }
        break;
      }
      case 'account.application.deauthorized': {
        // Business owner disconnected Pulse from their Stripe account via the
        // Stripe dashboard. Clear our stored account ID so they can reconnect.
        const deauth = event.data.object as { id: string };
        await this.prisma.business.updateMany({
          where: { stripeConnectAccountId: deauth.id },
          data: { stripeConnectAccountId: null, stripeConnectOnboarded: false },
        });
        this.logger.warn(`Stripe Connect account ${deauth.id} deauthorized — cleared from business record`);
        break;
      }
      case 'capability.updated': {
        // A specific capability (e.g. card_payments, transfers) changed status.
        // Log for visibility; stripeConnectOnboarded is reconciled via account.updated.
        const cap = event.data.object as Stripe.Capability;
        const acctId = typeof cap.account === 'string' ? cap.account : cap.account?.id;
        this.logger.log(`Capability ${cap.id} on account ${acctId} → ${cap.status}`);
        break;
      }
      case 'payout.paid': {
        const payout = event.data.object as Stripe.Payout;
        this.logger.log(`Payout paid: ${payout.id} amount=${payout.amount} ${payout.currency}`);
        // Notify the business owner that the payout landed
        const stripeAcct = (event as Stripe.Event & { account?: string }).account;
        if (stripeAcct) {
          const biz = await this.prisma.business.findFirst({
            where: { stripeConnectAccountId: stripeAcct },
            select: { id: true },
          });
          if (biz) {
            await this.prisma.systemError?.create?.({
              data: {
                businessId: biz.id,
                category: 'PAYMENT',
                severity: 'INFO',
                message: `Payout of ${(payout.amount / 100).toFixed(2)} ${payout.currency.toUpperCase()} arrived in your bank account.`,
                context: { payoutId: payout.id, status: 'paid' },
              },
            }).catch(() => {});
          }
        }
        break;
      }
      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout;
        this.logger.warn(`Payout failed: ${payout.id} reason=${payout.failure_message}`);
        const stripeAcct = (event as Stripe.Event & { account?: string }).account;
        if (stripeAcct) {
          const biz = await this.prisma.business.findFirst({
            where: { stripeConnectAccountId: stripeAcct },
            select: { id: true },
          });
          if (biz) {
            await this.prisma.systemError?.create?.({
              data: {
                businessId: biz.id,
                category: 'PAYMENT',
                severity: 'ERROR',
                message: `Payout failed: ${payout.failure_message ?? 'Unknown reason'}`,
                context: { payoutId: payout.id, status: 'failed' },
              },
            }).catch(() => {});
          }
        }
        break;
      }
    }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Stripe webhook processing failed for event ${event.type} (${event.id}): ${msg}`);
      await this.prisma.systemError.create({
        data: {
          category: 'PAYMENT',
          severity: 'ERROR',
          message: `Stripe webhook processing failed: ${msg}`.slice(0, 2000),
          context: { eventType: event.type, eventId: event.id },
        },
      }).catch(() => {});
      throw err;
    }

    return { received: true, eventId: event.id };
  }

  // ── SaaS subscription billing ────────────────────────────────────────────────
  private priceIdForPlan(plan: 'BASIC' | 'PRO' | 'UNLIMITED'): string | null {
    const keyMap = { BASIC: 'STRIPE_PRICE_BASIC', PRO: 'STRIPE_PRICE_PRO', UNLIMITED: 'STRIPE_PRICE_UNLIMITED' };
    return this.configService.get<string>(keyMap[plan]) || null;
  }

  private planForPriceId(priceId?: string | null): PlanTier {
    if (!priceId) return 'FREE';
    if (priceId === this.configService.get<string>('STRIPE_PRICE_BASIC')) return 'BASIC';
    if (priceId === this.configService.get<string>('STRIPE_PRICE_PRO')) return 'PRO';
    if (priceId === this.configService.get<string>('STRIPE_PRICE_UNLIMITED')) return 'UNLIMITED';
    return 'FREE';
  }

  private mapSubStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
    switch (s) {
      case 'active': return 'ACTIVE';
      case 'trialing': return 'TRIALING';
      case 'past_due':
      case 'unpaid': return 'PAST_DUE';
      case 'canceled':
      case 'incomplete_expired': return 'CANCELED';
      default: return 'INCOMPLETE';
    }
  }

  private effectiveSubscriptionPlan(status: SubscriptionStatus, priceId: string | null, periodEnd: Date | null): PlanTier {
    if (status === 'ACTIVE' || status === 'TRIALING') return this.planForPriceId(priceId);
    // Give past-due subscriptions access through the already-paid billing period.
    // Stripe may recover a failed renewal automatically; dropping the business to
    // Free immediately makes a temporary card failure unnecessarily disruptive.
    if (status === 'PAST_DUE' && periodEnd && periodEnd.getTime() + 3 * 24 * 60 * 60 * 1000 > Date.now()) {
      return this.planForPriceId(priceId);
    }
    return 'FREE';
  }

  // Reconcile our Subscription + Business.plan from a Stripe subscription object.
  private async applySubscription(businessId: string, sub: Stripe.Subscription) {
    const priceId = sub.items.data[0]?.price?.id ?? null;
    const status = this.mapSubStatus(sub.status);
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
    const effectivePlan = this.effectiveSubscriptionPlan(status, priceId, periodEnd);
    const data = {
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      plan: effectivePlan,
      status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    };
    // Notify the owner when their plan actually changes (upgrade/downgrade/cancel).
    const prev = await this.prisma.business.findUnique({ where: { id: businessId }, select: { plan: true } });
    await this.prisma.subscription.upsert({ where: { businessId }, create: { businessId, ...data }, update: data });
    await this.prisma.business.update({ where: { id: businessId }, data: { plan: effectivePlan, planExpiresAt: periodEnd } });
    if (prev && prev.plan !== effectivePlan) {
      await this.notifications.sendPlanChanged(businessId, effectivePlan).catch(() => {});
    }
    this.events.emitPlanUpdate(businessId, { plan: effectivePlan, planExpiresAt: periodEnd });
    // When a referred business becomes a paying customer, grant the referrer their
    // reward (once). Best-effort: a reward hiccup never breaks the subscription.
    if (effectivePlan !== 'FREE') {
      await this.grantReferralReward(businessId).catch(() => {});
    }
  }

  private membershipStatus(status: Stripe.Subscription.Status): 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' {
    if (status === 'active' || status === 'trialing') return 'ACTIVE';
    if (status === 'past_due' || status === 'unpaid') return 'PAST_DUE';
    if (status === 'canceled' || status === 'incomplete_expired') return 'CANCELLED';
    return 'PENDING';
  }

  private async applyClientMembership(businessId: string, membershipId: string | undefined, sub: Stripe.Subscription) {
    if (!membershipId) {
      this.logger.warn(`Client membership subscription ${sub.id} is missing membershipId metadata`);
      return;
    }
    const membership = await this.prisma.clientMembership.findFirst({ where: { id: membershipId, businessId } });
    if (!membership) {
      this.logger.warn(`Client membership ${membershipId} was not found for business ${businessId}`);
      return;
    }
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
    await this.prisma.clientMembership.update({
      where: { id: membership.id },
      data: {
        stripeSubscriptionId: sub.id,
        status: this.membershipStatus(sub.status),
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        ...(sub.status === 'canceled' ? { cancelledAt: new Date() } : {}),
      },
    });
  }

  async createClientMembershipCheckout(businessId: string, clientId: string, planId: string) {
    const [business, client, plan] = await Promise.all([
      this.prisma.business.findUnique({ where: { id: businessId } }),
      this.prisma.client.findFirst({ where: { id: clientId, businessId } }),
      this.prisma.membershipPlan.findFirst({ where: { id: planId, businessId, active: true } }),
    ]);
    if (!business) throw new NotFoundException('Business not found');
    if (!client) throw new NotFoundException('Client not found');
    if (!plan) throw new NotFoundException('Membership plan not found');
    if (!business.stripeConnectAccountId || !business.stripeConnectOnboarded) {
      throw new BadRequestException('Connect Stripe before enrolling clients in paid memberships.');
    }
    const existing = await this.prisma.clientMembership.findFirst({
      where: {
        clientId,
        planId,
        OR: [
          { status: { in: ['ACTIVE', 'PAST_DUE'] } },
          { status: 'PENDING', createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) } },
        ],
      },
    });
    if (existing) throw new BadRequestException('Client already has this membership or a checkout in progress');

    let priceId = plan.stripePriceId;
    let productId = plan.stripeProductId;
    if (!priceId) {
      // SELECT FOR UPDATE serializes concurrent first-enrollment requests so only
      // one creates the Stripe product+price pair. Without this, two simultaneous
      // requests both see stripePriceId = null and produce orphaned Stripe objects.
      const resolved = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "MembershipPlan" WHERE id = ${plan.id} FOR UPDATE`;
        const fresh = await tx.membershipPlan.findUnique({
          where: { id: plan.id },
          select: { stripePriceId: true, stripeProductId: true },
        });
        if (fresh?.stripePriceId) {
          return { priceId: fresh.stripePriceId, productId: fresh.stripeProductId };
        }
        const product = await this.getStripe().products.create({
          name: `${business.name} - ${plan.name}`,
          description: plan.description ?? undefined,
          metadata: { kind: 'client_membership_plan', businessId, planId },
        });
        const price = await this.getStripe().prices.create({
          product: product.id,
          unit_amount: plan.priceMonthly,
          currency: this.currencyOf(business),
          recurring: { interval: 'month' },
          metadata: { kind: 'client_membership_plan', businessId, planId },
        });
        await tx.membershipPlan.update({
          where: { id: plan.id }, data: { stripeProductId: product.id, stripePriceId: price.id },
        });
        return { priceId: price.id, productId: product.id };
      });
      priceId = resolved.priceId;
      productId = resolved.productId;
    }

    const membership = await this.prisma.clientMembership.create({
      data: { businessId, clientId, planId, status: 'PENDING' },
    });
    try {
      const customerId = await this.ensureCustomer(client.id);
      const metadata = { kind: 'client_membership', businessId, clientId, planId, membershipId: membership.id };
      const webUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
      const session = await this.getStripe().checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${webUrl}/dashboard/memberships?membership=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${webUrl}/dashboard/memberships?membership=cancel&membership_id=${membership.id}`,
        metadata,
        subscription_data: {
          metadata,
          transfer_data: { destination: business.stripeConnectAccountId },
          application_fee_percent: this.platformFeePercent(business.plan),
        },
      }, { idempotencyKey: this.idempotencyKey(['client-membership', membership.id]) });
      if (!session.url) throw new ServiceUnavailableException('Stripe did not return a checkout URL. Please try again.');
      return { url: session.url, membershipId: membership.id };
    } catch (error) {
      await this.prisma.clientMembership.delete({ where: { id: membership.id } }).catch(() => {});
      throw error;
    }
  }

  async confirmClientMembershipCheckout(businessId: string, sessionId: string) {
    const session = await this.getStripe().checkout.sessions.retrieve(sessionId);
    if (session.mode !== 'subscription' || session.metadata?.kind !== 'client_membership' ||
        session.metadata.businessId !== businessId || !session.subscription) {
      throw new BadRequestException('This checkout session does not belong to a client membership.');
    }
    if (session.status !== 'complete') return { confirmed: false as const, reason: 'checkout_incomplete' as const };
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    const sub = await this.getStripe().subscriptions.retrieve(subId);
    await this.applyClientMembership(businessId, session.metadata.membershipId, sub);
    return { confirmed: true as const, membershipId: session.metadata.membershipId, status: this.membershipStatus(sub.status) };
  }

  async archiveMembershipPlanStripe(priceId: string, productId: string | null): Promise<void> {
    await this.getStripe().prices.update(priceId, { active: false }).catch((e) =>
      this.logger.warn(`Could not archive Stripe price ${priceId}: ${e.message}`),
    );
    if (productId) {
      await this.getStripe().products.update(productId, { active: false }).catch((e) =>
        this.logger.warn(`Could not archive Stripe product ${productId}: ${e.message}`),
      );
    }
  }

  async cancelClientMembership(businessId: string, membershipId: string) {
    const membership = await this.prisma.clientMembership.findFirst({ where: { id: membershipId, businessId } });
    if (!membership) throw new NotFoundException('Membership not found');
    if (!membership.stripeSubscriptionId) {
      return this.prisma.clientMembership.update({
        where: { id: membership.id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelAtPeriodEnd: false },
      });
    }
    if (membership.cancelAtPeriodEnd) {
      return this.prisma.clientMembership.findUniqueOrThrow({ where: { id: membership.id } });
    }
    const sub = await this.getStripe().subscriptions.update(membership.stripeSubscriptionId, { cancel_at_period_end: true });
    await this.applyClientMembership(businessId, membership.id, sub);
    return this.prisma.clientMembership.findUniqueOrThrow({ where: { id: membership.id } });
  }

  // Grant the referrer of `referredBusinessId` an account credit, applied to their
  // next Pulse invoice. Controlled by REFERRAL_REWARD_CENTS (default $10; set 0 to
  // disable). Idempotent via ReferralsService.claimPendingReward.
  private async grantReferralReward(referredBusinessId: string) {
    const rewardCents = parseInt(this.configService.get<string>('REFERRAL_REWARD_CENTS') ?? '1000', 10);
    if (!rewardCents || rewardCents <= 0) return;
    const referrerId = await this.referrals.claimPendingReward(referredBusinessId);
    if (!referrerId) return;
    const referrer = await this.prisma.business.findUnique({
      where: { id: referrerId },
      select: { id: true, name: true, email: true },
    });
    if (!referrer) return;
    // Negative balance transaction = credit on the customer's Stripe balance,
    // automatically deducted from their next subscription invoice.
    const customerId = await this.ensureBusinessCustomer(referrer);
    await this.getStripe().customers.createBalanceTransaction(customerId, {
      amount: -rewardCents,
      currency: this.stripeCurrency(),
      description: 'Pulse referral reward — a business you referred subscribed',
    });
  }

  private async ensureBusinessCustomer(business: { id: string; name: string; email: string }): Promise<string> {
    const sub = await this.prisma.subscription.findUnique({ where: { businessId: business.id } });
    if (sub?.stripeCustomerId) return sub.stripeCustomerId;
    const customer = await this.getStripe().customers.create({
      name: business.name, email: business.email, metadata: { businessId: business.id },
    });
    await this.prisma.subscription.upsert({
      where: { businessId: business.id },
      create: { businessId: business.id, stripeCustomerId: customer.id, plan: 'FREE' },
      update: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  // Owner — start a Stripe Checkout session to subscribe to a paid plan.
  async createSubscriptionCheckout(businessId: string, plan: 'BASIC' | 'PRO' | 'UNLIMITED', referralCode?: string) {
    const priceId = this.priceIdForPlan(plan);
    if (!priceId) throw new BadRequestException(`The ${plan} plan is not available for purchase yet.`);
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    const customerId = await this.ensureBusinessCustomer(business);
    const webUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';

    // Already subscribed? Switch the plan IN PLACE with proration instead of a new
    // checkout — Stripe credits the unused time on the old plan and immediately
    // invoices only the difference (e.g. Basic→Pro mid-cycle ≈ +$10, not $20).
    // We look up the live subscription from our DB first, then fall back to Stripe
    // directly (in case our DB is stale, e.g. a missed webhook) so we NEVER create
    // a second active subscription on the same customer.
    const existing = await this.prisma.subscription.findUnique({ where: { businessId } });
    let activeSubId: string | null =
      existing?.stripeSubscriptionId && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(existing.status ?? '')
        ? existing.stripeSubscriptionId
        : null;
    if (!activeSubId) {
      try {
        const subs = await this.getStripe().subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
        activeSubId = subs.data.find((sub) =>
          ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(sub.status),
        )?.id ?? null;
      } catch { /* ignore */ }
    }
    if (activeSubId) {
      try {
        const sub = await this.getStripe().subscriptions.retrieve(activeSubId);
        const itemId = sub.items.data[0]?.id;
        const currentPrice = sub.items.data[0]?.price?.id;
        if (sub.status !== 'canceled' && itemId) {
          if (currentPrice === priceId) {
            // Already on this plan — just reconcile our records.
            await this.applySubscription(businessId, sub);
            return { updated: true as const, plan };
          }
          const updated = await this.getStripe().subscriptions.update(activeSubId, {
            items: [{ id: itemId, price: priceId }],
            proration_behavior: 'always_invoice', // charge/credit the difference now
            metadata: { businessId, plan },
          });
          await this.applySubscription(businessId, updated);
          return { updated: true as const, plan };
        }
      } catch {
        // Fail closed against duplicate subscriptions. Only start a fresh Checkout
        // when Stripe itself confirms there is no longer any live subscription.
        try {
          const subs = await this.getStripe().subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
          const live = subs.data.some((sub) =>
            ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(sub.status),
          );
          if (live) {
            throw new BadRequestException('Your existing subscription could not be updated. Open Manage billing or try again shortly.');
          }
        } catch (error) {
          if (error instanceof BadRequestException) throw error;
          throw new ServiceUnavailableException('Could not verify your existing Stripe subscription. Please try again shortly.');
        }
      }
    }

    // Referral: if a valid code is applied, record it and (when a Stripe coupon
    // is configured) attach it as the checkout discount. Otherwise let the owner
    // enter any standard Stripe promotion code.
    const referralCoupon = this.configService.get<string>('STRIPE_REFERRAL_COUPON');
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    if (referralCode?.trim()) {
      const recorded = await this.referrals.recordReferral(businessId, referralCode).catch(() => false);
      if (recorded && referralCoupon) discounts = [{ coupon: referralCoupon }];
    }

    const session = await this.getStripe().checkout.sessions.create({
      mode: 'subscription',
      currency: this.stripeCurrency(),
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${webUrl}/dashboard/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${webUrl}/dashboard/settings?billing=cancel`,
      metadata: { businessId, plan, ...(referralCode?.trim() ? { referralCode: referralCode.trim() } : {}) },
      subscription_data: { metadata: { businessId, plan } },
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
    }, {
      // Deduplicate double-clicks without returning an expired Checkout Session
      // forever when the same business retries the same plan later.
      idempotencyKey: this.idempotencyKey([
        'subscription-checkout', businessId, plan, referralCode ?? '', Math.floor(Date.now() / (5 * 60 * 1000)),
      ]),
    });
    return { url: session.url };
  }

  // Verify the Checkout Session belongs to this business, then reconcile the
  // Stripe subscription synchronously. This removes the user-visible webhook lag
  // while keeping webhook processing as the ongoing source of lifecycle updates.
  async confirmSubscriptionCheckout(businessId: string, sessionId: string) {
    const session = await this.getStripe().checkout.sessions.retrieve(sessionId);
    if (session.mode !== 'subscription' || session.metadata?.businessId !== businessId || !session.subscription) {
      throw new BadRequestException('This checkout session does not belong to your business subscription.');
    }
    if (session.status !== 'complete') {
      return { confirmed: false as const, reason: 'checkout_incomplete' as const };
    }
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    const sub = await this.getStripe().subscriptions.retrieve(subId);
    await this.applySubscription(businessId, sub);
    return {
      confirmed: true as const,
      plan: this.effectiveSubscriptionPlan(
        this.mapSubStatus(sub.status),
        sub.items.data[0]?.price?.id ?? null,
        sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      ),
      status: this.mapSubStatus(sub.status),
    };
  }

  // Owner — open the Stripe billing portal (update card, cancel, view invoices).
  async createBillingPortal(businessId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    if (!sub?.stripeCustomerId) throw new BadRequestException('No billing account yet — subscribe to a plan first.');
    const webUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    const session = await this.getStripe().billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${webUrl}/dashboard/settings`,
    });
    return { url: session.url };
  }

  async getSubscription(businessId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId }, select: { plan: true, planExpiresAt: true },
    });
    return {
      plan: business.plan,
      status: sub?.status ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? business.planExpiresAt ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
      hasBilling: !!sub?.stripeCustomerId,
    };
  }

  /**
   * Owner-initiated refund of a customer payment (full or partial). Creates a
   * Stripe refund, writes a Refund ledger row, and updates the Payment's
   * refunded total + status. Scoped to the owner's business.
   */
  async refundPayment(
    businessId: string,
    paymentId: string,
    input: { amountCents?: number; reason?: string },
  ) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, businessId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'SUCCEEDED' && payment.status !== 'PARTIALLY_REFUNDED') {
      throw new BadRequestException('Only a settled payment can be refunded');
    }
    if (!payment.stripePaymentIntentId) {
      throw new BadRequestException(
        payment.squarePaymentId
          ? 'This legacy Square payment must be refunded from the Square Dashboard'
          : 'This payment has no Stripe charge to refund',
      );
    }
    const remaining = payment.amountCents - payment.refundedCents;
    const amount = input.amountCents ?? remaining;
    if (amount <= 0 || amount > remaining) {
      throw new BadRequestException(`Refund amount must be between 1 and ${remaining} cents`);
    }

    const stripeRefund = await this.getStripe().refunds.create({
      payment_intent: payment.stripePaymentIntentId,
      amount,
      ...(input.reason ? { metadata: { reason: input.reason } } : {}),
    }, {
      idempotencyKey: this.idempotencyKey([
        'refund',
        businessId,
        payment.id,
        amount,
        payment.refundedCents,
        input.reason?.trim(),
      ]),
    });

    const refundStatus = stripeRefund.status === 'succeeded' ? 'SUCCEEDED' : stripeRefund.status === 'failed' ? 'FAILED' : 'PENDING';
    const result = await this.prisma.$transaction(async (tx) => {
      const existingRefund = await tx.refund.findUnique({ where: { stripeRefundId: stripeRefund.id } });
      if (existingRefund) {
        const currentPayment = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
        return { refund: existingRefund, refundedCents: currentPayment.refundedCents, status: currentPayment.status };
      }
      const refund = await tx.refund.create({
        data: {
          businessId, paymentId: payment.id, stripeRefundId: stripeRefund.id,
          amountCents: amount, reason: input.reason,
          status: refundStatus,
        },
      });
      if (refundStatus !== 'SUCCEEDED') {
        return { refund, refundedCents: payment.refundedCents, status: payment.status };
      }
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { refundedCents: { increment: amount } },
      });
      const status: PaymentStatus = updated.refundedCents >= updated.amountCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      if (updated.status !== status) {
        await tx.payment.update({ where: { id: payment.id }, data: { status } });
      }
      return { refund, refundedCents: updated.refundedCents, status };
    });
    return { ...result, paymentId: payment.id };
  }

  // Owner-scoped payment ledger for the business (newest first).
  async listPayments(businessId: string, limit = 100) {
    return this.prisma.payment.findMany({
      where: { businessId },
      include: {
        refunds: { orderBy: { createdAt: 'desc' } },
        client: { select: { id: true, name: true, email: true } },
        appointment: { select: { id: true, startsAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  /**
   * Real no-show charge: charges the saved card off_session for the business's
   * configured no-show fee, then marks the appointment NO_SHOW. Requires a saved
   * customer + payment method (captured at booking via deposit or card-on-file).
   */
  async chargeNoShowFee(appointmentId: string, businessId: string) {
    const apt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, businessId },
      include: { service: true, client: true, business: true },
    });
    if (!apt) throw new BadRequestException('Appointment not found');
    if (apt.status !== 'CONFIRMED') throw new BadRequestException(`Cannot mark as NO_SHOW: appointment is ${apt.status}`);
    if (!isProPlan(apt.business.plan)) {
      await this.prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'NO_SHOW' } });
      return { charged: false, feeCents: 0, message: 'Marked NO_SHOW. Automatic no-show charging requires Pro; collect manually on Basic.' };
    }

    if ((apt.business.noShowFeeCents ?? 0) === 0) {
      await this.prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'NO_SHOW' } });
      return { charged: false, feeCents: 0, message: 'Marked NO_SHOW. No no-show fee configured — collect manually if needed.' };
    }
    const feeCents = apt.business.noShowFeeCents;

    if (!apt.client.stripeCustomerId || !apt.stripePaymentMethodId) {
      // No saved card — can't auto-charge; mark NO_SHOW for manual collection.
      await this.prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'NO_SHOW' } });
      return { charged: false, feeCents, message: 'Marked NO_SHOW. No saved card on file — collect the fee manually.' };
    }

    const intent = await this.getStripe().paymentIntents.create({
      amount: feeCents,
      currency: this.currencyOf(apt.business),
      customer: apt.client.stripeCustomerId,
      payment_method: apt.stripePaymentMethodId,
      ...(apt.client.email ? { receipt_email: apt.client.email } : {}),
      off_session: true,
      confirm: true,
      metadata: { appointmentId, businessId, kind: 'no_show_fee' },
      description: `No-show fee — ${apt.service.name} @ ${apt.business.name}`,
      ...this.connectChargeParams(apt.business, feeCents),
    }, { idempotencyKey: this.idempotencyKey(['no-show', businessId, appointmentId, feeCents]) });

    await this.prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'NO_SHOW' } });
    await this.recordPayment({
      businessId, appointmentId, clientId: apt.clientId,
      stripePaymentIntentId: intent.id, amountCents: feeCents,
      kind: 'NO_SHOW_FEE', status: intent.status === 'succeeded' ? 'SUCCEEDED' : 'FAILED',
      description: `No-show fee — ${apt.service.name}`,
    });
    if (intent.status === 'succeeded') {
      await this.notifications.sendNoShowFeeCharged(appointmentId, feeCents).catch(() => {});
    }
    return { charged: intent.status === 'succeeded', feeCents, paymentIntentId: intent.id, status: intent.status };
  }

  /**
   * Late-cancellation fee: charges the saved card off_session for the business's
   * configured cancellation fee. Best-effort — NEVER throws, so the cancellation
   * itself always succeeds even if Stripe is unconfigured or the card declines.
   * Does NOT change appointment status (the caller sets it to CANCELLED).
   */
  async chargeCancellationFee(appointmentId: string, businessId: string): Promise<{ charged: boolean; feeCents: number; reason?: string }> {
    const apt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, businessId },
      include: { service: true, client: true, business: true },
    });
    if (!apt) return { charged: false, feeCents: 0, reason: 'not_found' };
    if (!isProPlan(apt.business.plan)) return { charged: false, feeCents: 0, reason: 'plan_requires_pro' };
    const feeCents = apt.business.cancellationFeeCents;
    if (feeCents <= 0) return { charged: false, feeCents: 0, reason: 'no_fee' };
    if (!apt.client.stripeCustomerId || !apt.stripePaymentMethodId) {
      return { charged: false, feeCents, reason: 'no_card' };
    }
    try {
      const intent = await this.getStripe().paymentIntents.create({
        amount: feeCents,
        currency: this.currencyOf(apt.business),
        customer: apt.client.stripeCustomerId,
        payment_method: apt.stripePaymentMethodId,
        ...(apt.client.email ? { receipt_email: apt.client.email } : {}),
        off_session: true,
        confirm: true,
        metadata: { appointmentId, businessId, kind: 'late_cancel_fee' },
        description: `Late cancellation fee — ${apt.service.name} @ ${apt.business.name}`,
        ...this.connectChargeParams(apt.business, feeCents),
      }, { idempotencyKey: this.idempotencyKey(['late-cancel', businessId, appointmentId, feeCents]) });
      await this.recordPayment({
        businessId, appointmentId, clientId: apt.clientId,
        stripePaymentIntentId: intent.id, amountCents: feeCents,
        kind: 'LATE_CANCEL_FEE', status: intent.status === 'succeeded' ? 'SUCCEEDED' : 'FAILED',
        description: `Late cancellation fee — ${apt.service.name}`,
      });
      if (intent.status === 'succeeded') {
        await this.notifications.sendCancellationFeeCharged(appointmentId, feeCents).catch(() => {});
      }
      return { charged: intent.status === 'succeeded', feeCents, reason: intent.status };
    } catch {
      return { charged: false, feeCents, reason: 'charge_failed' };
    }
  }

  // ── Stripe Connect Express (business payouts) ────────────────────────────────

  /**
   * Get or create a Stripe Connect Express account for the business and return
   * an account-link onboarding URL. Idempotent: re-entering the onboarding flow
   * (e.g. after an interrupted session) returns a fresh link for the same account.
   */
  async getConnectOnboardingUrl(businessId: string): Promise<{ url: string; accountId: string }> {
    const stripe = this.getStripe();
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    const webUrl = (this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? '').replace(/\/$/, '') || 'https://pulseappointments.com';

    try {
      let accountId = business.stripeConnectAccountId;
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          email: business.email,
          business_type: 'individual',
          metadata: { businessId },
          settings: { payouts: { schedule: { interval: 'manual' } } },
        });
        accountId = account.id;
        await this.prisma.business.update({ where: { id: businessId }, data: { stripeConnectAccountId: accountId } });
      }

      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${webUrl}/dashboard/settings?tab=payouts&connect=refresh`,
        return_url: `${webUrl}/dashboard/settings?tab=payouts&connect=success`,
        type: 'account_onboarding',
      });

      return { url: link.url, accountId };
    } catch (err) {
      // Surface the real Stripe error message so the dashboard can display it.
      const msg = err instanceof Stripe.errors.StripeError
        ? `Stripe: ${err.message}`
        : (err instanceof Error ? err.message : 'Could not start Stripe onboarding');
      this.logger.error(`Connect onboarding failed for business ${businessId}: ${msg}`);
      throw new BadRequestException(msg);
    }
  }

  /** Open the Stripe Express dashboard (login link) for the business. */
  async getConnectDashboardUrl(businessId: string): Promise<{ url: string }> {
    const stripe = this.getStripe();
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    if (!business.stripeConnectAccountId) {
      throw new BadRequestException('Connect account not set up — complete onboarding first.');
    }
    const link = await stripe.accounts.createLoginLink(business.stripeConnectAccountId);
    return { url: link.url };
  }

  /** Return onboarding status + available/pending balance for the Connect account. */
  async getConnectStatus(businessId: string) {
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    if (!business.stripeConnectAccountId) {
      return { onboarded: false, chargesEnabled: false, accountId: null, available: [], pending: [] };
    }
    const stripe = this.getStripe();
    const account = await stripe.accounts.retrieve(business.stripeConnectAccountId);
    const onboarded = !!account.details_submitted;
    const chargesEnabled = !!account.charges_enabled;
    if (onboarded !== business.stripeConnectOnboarded) {
      await this.prisma.business.update({ where: { id: businessId }, data: { stripeConnectOnboarded: onboarded } });
    }
    // Only fetch balance once charges are enabled — before that the endpoint
    // returns zeros and counts as a billable API call.
    const balance = chargesEnabled
      ? await stripe.balance.retrieve({}, { stripeAccount: business.stripeConnectAccountId })
      : null;
    return {
      onboarded,
      chargesEnabled,
      accountId: business.stripeConnectAccountId,
      available: balance?.available.map((b) => ({ amount: b.amount, currency: b.currency })) ?? [],
      pending: balance?.pending.map((b) => ({ amount: b.amount, currency: b.currency })) ?? [],
    };
  }

  /**
   * Trigger a manual payout from the Connect account to the business's linked bank account.
   * `instant` triggers an instant payout to a registered debit card (higher fee, immediate).
   */
  async createConnectPayout(
    businessId: string,
    input: { amountCents: number; currency?: string; instant?: boolean; idempotencyKey: string },
  ) {
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    if (!business.stripeConnectAccountId || !business.stripeConnectOnboarded) {
      throw new BadRequestException('Complete Stripe onboarding before requesting a payout.');
    }
    const stripe = this.getStripe();
    const currency = (input.currency ?? business.currency ?? 'CAD').toLowerCase();
    const payout = await stripe.payouts.create(
      {
        amount: input.amountCents,
        currency,
        ...(input.instant ? { method: 'instant' as const } : {}),
        metadata: { businessId },
      },
      {
        stripeAccount: business.stripeConnectAccountId,
        idempotencyKey: this.idempotencyKey(['connect-payout', businessId, input.idempotencyKey]),
      },
    );
    return { payoutId: payout.id, status: payout.status, amountCents: payout.amount, currency: payout.currency };
  }

  // ── Client card-on-file management (portal) ─────────────────────────────────
  // Does this client (matched by email across their records) have a saved card?
  async clientCardStatus(email: string) {
    const clients = await this.prisma.client.findMany({ where: { email }, select: { id: true } });
    const clientIds = clients.map((c) => c.id);
    if (!clientIds.length) return { hasCard: false };
    const count = await this.prisma.appointment.count({
      where: { clientId: { in: clientIds }, stripePaymentMethodId: { not: null } },
    });
    return { hasCard: count > 0 };
  }

  // Client-initiated: detach every saved card from Stripe and clear it from their
  // appointments, so it can no longer be auto-charged (no-show/late-cancel) or
  // manually charged. Best-effort per card; always clears the stored references.
  async removeClientCards(email: string) {
    const clients = await this.prisma.client.findMany({ where: { email }, select: { id: true } });
    const clientIds = clients.map((c) => c.id);
    if (!clientIds.length) return { removed: 0 };
    const appts = await this.prisma.appointment.findMany({
      where: { clientId: { in: clientIds }, stripePaymentMethodId: { not: null } },
      select: { stripePaymentMethodId: true },
    });
    const pmIds = [...new Set(appts.map((a) => a.stripePaymentMethodId).filter((x): x is string => !!x))];
    for (const pm of pmIds) {
      try { await this.getStripe().paymentMethods.detach(pm); } catch { /* already detached/unconfigured */ }
    }
    await this.prisma.appointment.updateMany({
      where: { clientId: { in: clientIds } },
      data: { stripePaymentMethodId: null },
    });
    return { removed: pmIds.length };
  }
}
