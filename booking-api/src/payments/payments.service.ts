import { Injectable, BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentKind, PaymentStatus, PlanTier, SubscriptionStatus } from '@prisma/client';
import { createHash } from 'crypto';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private stripe: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private notifications: NotificationsService,
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
      this.stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' as any });
    }
    return this.stripe;
  }

  private publishableKey(): string {
    return this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') ?? '';
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
    kind: PaymentKind;
    status: PaymentStatus;
    description?: string;
  }) {
    try {
      await this.prisma.payment.create({ data });
    } catch (err) {
      console.error('[ledger] failed to record payment', err);
    }
  }

  // Get-or-create a Stripe Customer for a client and persist the id so cards can
  // be saved and re-charged (deposits / no-show protection).
  private async ensureCustomer(clientId: string): Promise<string> {
    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    if (client.stripeCustomerId) return client.stripeCustomerId;
    const customer = await this.getStripe().customers.create({
      name: client.name,
      email: client.email,
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
  async createBookingIntent(appointmentId: string, businessId: string) {
    const apt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, businessId },
      include: { service: true, client: true, business: true },
    });
    if (!apt) throw new BadRequestException('Appointment not found');

    const b = apt.business;
    // Deposits / card-on-file are a PAID-plan feature. Free tier never collects
    // money at booking (and clients can cancel at will).
    if (b.plan === 'FREE') return { required: false, mode: 'none' as const };

    const customer = await this.ensureCustomer(apt.clientId);

    if (b.requireDeposit) {
      const depositCents = Math.max(50, Math.round(apt.service.priceCents * (b.depositPercent / 100)));
      const intent = await this.getStripe().paymentIntents.create({
        amount: depositCents,
        currency: 'usd',
        customer,
        receipt_email: apt.client.email, // Stripe emails the official receipt on success
        setup_future_usage: 'off_session', // save the card for a possible no-show charge
        // Card-only: no redirect-based methods, so the client can confirm without
        // supplying a return_url.
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { appointmentId, businessId, kind: 'deposit' },
        description: `Deposit — ${apt.service.name} @ ${b.name}`,
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
      return { required: true, mode: 'payment' as const, clientSecret: intent.client_secret, amountCents: depositCents, publishableKey: this.publishableKey() };
    }

    if (b.noShowFeeCents > 0) {
      const intent = await this.getStripe().setupIntents.create({
        customer,
        usage: 'off_session',
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { appointmentId, businessId, kind: 'card_on_file' },
      }, { idempotencyKey: this.idempotencyKey(['card-on-file', businessId, appointmentId]) });
      return { required: true, mode: 'setup' as const, clientSecret: intent.client_secret, amountCents: 0, publishableKey: this.publishableKey() };
    }

    return { required: false, mode: 'none' as const };
  }

  // Owner-initiated deposit (kept for dashboard use); same logic, ownership checked
  // by the controller passing the business.
  async createDepositIntent(appointmentId: string, businessId: string) {
    return this.createBookingIntent(appointmentId, businessId);
  }

  /**
   * In-person custom charge (mobile Checkout → Tap to Pay on iPhone).
   * Creates a PaymentIntent for an arbitrary amount so the transaction is recorded
   * in Stripe and shows on the dashboard. The contactless capture is performed by
   * the in-app reader: the Stripe Terminal "Tap to Pay on iPhone" SDK collects the
   * card and confirms THIS intent (drop-in once the Apple proximity-reader
   * entitlement is granted). We return the client secret + publishable key so that
   * hook can confirm without another round-trip.
   */
  async createCustomCharge(
    businessId: string,
    input: { amountCents: number; description?: string; clientId?: string; idempotencyKey?: string },
  ) {
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    const chargeClient = input.clientId
      ? await this.prisma.client.findUnique({ where: { id: input.clientId }, select: { email: true } })
      : null;
    const intent = await this.getStripe().paymentIntents.create({
      amount: input.amountCents,
      currency: 'usd',
      ...(chargeClient?.email ? { receipt_email: chargeClient.email } : {}),
      // Card-only, no redirect methods — the reader confirms on-device.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        businessId,
        kind: 'tap_to_pay',
        ...(input.clientId ? { clientId: input.clientId } : {}),
      },
      description: input.description?.trim() || `In-person charge — ${business.name}`,
    }, {
      idempotencyKey: input.idempotencyKey?.trim()
        ? this.idempotencyKey(['custom', businessId, input.idempotencyKey.trim()])
        : this.idempotencyKey([
          'custom',
          businessId,
          input.clientId,
          input.amountCents,
          input.description?.trim(),
          Math.floor(Date.now() / 60_000),
        ]),
    });
    await this.recordPayment({
      businessId, clientId: input.clientId ?? null,
      stripePaymentIntentId: intent.id, amountCents: input.amountCents,
      kind: 'IN_PERSON', status: 'PENDING',
      description: input.description?.trim() || `In-person charge`,
    });
    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amountCents: input.amountCents,
      currency: 'usd',
      status: intent.status,
      publishableKey: this.publishableKey(),
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';

    if (!webhookSecret.startsWith('whsec_')) {
      // In production, fail CLOSED and loudly: a missing/invalid secret means the
      // webhook is misconfigured (deposits won't auto-confirm) — surface it as an
      // error so Stripe flags failed deliveries and the operator notices, rather
      // than silently 200-ing. Outside production, no-op so local/dev works.
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Stripe webhook secret is not configured');
      }
      return { received: true, skipped: 'stripe webhook deferred — not configured' };
    }

    let event: Stripe.Event;
    try {
      event = this.getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

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
          await this.prisma.appointment.updateMany({
            where: { id: appointmentId, stripePaymentIntentId: intent.id },
            data: { status: 'CANCELLED' },
          });
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
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          const businessId = session.metadata?.businessId;
          const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          if (businessId) {
            const sub = await this.getStripe().subscriptions.retrieve(subId);
            await this.applySubscription(businessId, sub);
          }
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const businessId = sub.metadata?.businessId;
        if (businessId) await this.applySubscription(businessId, sub);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const businessId = sub.metadata?.businessId;
        if (businessId) {
          await this.prisma.subscription.updateMany({
            where: { businessId },
            data: { status: 'CANCELED', plan: 'FREE', cancelAtPeriodEnd: false },
          });
          await this.prisma.business.update({ where: { id: businessId }, data: { plan: 'FREE', planExpiresAt: null } });
        }
        break;
      }
    }

    return { received: true, eventId: event.id };
  }

  // ── SaaS subscription billing ────────────────────────────────────────────────
  private priceIdForPlan(plan: 'BASIC' | 'PRO'): string | null {
    const key = plan === 'BASIC' ? 'STRIPE_PRICE_BASIC' : 'STRIPE_PRICE_PRO';
    return this.configService.get<string>(key) || null;
  }

  private planForPriceId(priceId?: string | null): PlanTier {
    if (!priceId) return 'FREE';
    if (priceId === this.configService.get<string>('STRIPE_PRICE_BASIC')) return 'BASIC';
    if (priceId === this.configService.get<string>('STRIPE_PRICE_PRO')) return 'PRO';
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

  // Reconcile our Subscription + Business.plan from a Stripe subscription object.
  private async applySubscription(businessId: string, sub: Stripe.Subscription) {
    const priceId = sub.items.data[0]?.price?.id ?? null;
    const status = this.mapSubStatus(sub.status);
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
    // Only an active/trialing subscription grants the paid tier; anything else
    // (past_due, canceled, …) falls back to FREE.
    const effectivePlan: PlanTier = status === 'ACTIVE' || status === 'TRIALING' ? this.planForPriceId(priceId) : 'FREE';
    const data = {
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      plan: effectivePlan,
      status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    };
    await this.prisma.subscription.upsert({ where: { businessId }, create: { businessId, ...data }, update: data });
    await this.prisma.business.update({ where: { id: businessId }, data: { plan: effectivePlan, planExpiresAt: periodEnd } });
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
  async createSubscriptionCheckout(businessId: string, plan: 'BASIC' | 'PRO') {
    const priceId = this.priceIdForPlan(plan);
    if (!priceId) throw new BadRequestException(`The ${plan} plan is not available for purchase yet.`);
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    const customerId = await this.ensureBusinessCustomer(business);
    const webUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    const session = await this.getStripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${webUrl}/dashboard/settings?billing=success`,
      cancel_url: `${webUrl}/dashboard/settings?billing=cancel`,
      metadata: { businessId, plan },
      subscription_data: { metadata: { businessId, plan } },
    }, { idempotencyKey: this.idempotencyKey(['subscription-checkout', businessId, plan]) });
    return { url: session.url };
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
      throw new BadRequestException('This payment has no Stripe charge to refund');
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

    const refundedTotal = payment.refundedCents + amount;
    const newStatus: PaymentStatus = refundedTotal >= payment.amountCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    const [refund] = await this.prisma.$transaction([
      this.prisma.refund.create({
        data: {
          businessId, paymentId: payment.id, stripeRefundId: stripeRefund.id,
          amountCents: amount, reason: input.reason,
          status: stripeRefund.status === 'succeeded' ? 'SUCCEEDED' : stripeRefund.status === 'failed' ? 'FAILED' : 'PENDING',
        },
      }),
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { refundedCents: refundedTotal, status: newStatus },
      }),
    ]);
    return { refund, paymentId: payment.id, refundedCents: refundedTotal, status: newStatus };
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

    const feeCents = apt.business.noShowFeeCents > 0
      ? apt.business.noShowFeeCents
      : Math.round(apt.service.priceCents * 0.5); // fallback: 50% of service price

    if (!apt.client.stripeCustomerId || !apt.stripePaymentMethodId) {
      // No saved card — can't auto-charge; mark NO_SHOW for manual collection.
      await this.prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'NO_SHOW' } });
      return { charged: false, feeCents, message: 'Marked NO_SHOW. No saved card on file — collect the fee manually.' };
    }

    const intent = await this.getStripe().paymentIntents.create({
      amount: feeCents,
      currency: 'usd',
      customer: apt.client.stripeCustomerId,
      payment_method: apt.stripePaymentMethodId,
      receipt_email: apt.client.email,
      off_session: true,
      confirm: true,
      metadata: { appointmentId, businessId, kind: 'no_show_fee' },
      description: `No-show fee — ${apt.service.name} @ ${apt.business.name}`,
    }, { idempotencyKey: this.idempotencyKey(['no-show', businessId, appointmentId, feeCents]) });

    await this.prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'NO_SHOW' } });
    await this.recordPayment({
      businessId, appointmentId, clientId: apt.clientId,
      stripePaymentIntentId: intent.id, amountCents: feeCents,
      kind: 'NO_SHOW_FEE', status: intent.status === 'succeeded' ? 'SUCCEEDED' : 'FAILED',
      description: `No-show fee — ${apt.service.name}`,
    });
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
    const feeCents = apt.business.cancellationFeeCents;
    if (feeCents <= 0) return { charged: false, feeCents: 0, reason: 'no_fee' };
    if (!apt.client.stripeCustomerId || !apt.stripePaymentMethodId) {
      return { charged: false, feeCents, reason: 'no_card' };
    }
    try {
      const intent = await this.getStripe().paymentIntents.create({
        amount: feeCents,
        currency: 'usd',
        customer: apt.client.stripeCustomerId,
        payment_method: apt.stripePaymentMethodId,
        receipt_email: apt.client.email,
        off_session: true,
        confirm: true,
        metadata: { appointmentId, businessId, kind: 'late_cancel_fee' },
        description: `Late cancellation fee — ${apt.service.name} @ ${apt.business.name}`,
      }, { idempotencyKey: this.idempotencyKey(['late-cancel', businessId, appointmentId, feeCents]) });
      await this.recordPayment({
        businessId, appointmentId, clientId: apt.clientId,
        stripePaymentIntentId: intent.id, amountCents: feeCents,
        kind: 'LATE_CANCEL_FEE', status: intent.status === 'succeeded' ? 'SUCCEEDED' : 'FAILED',
        description: `Late cancellation fee — ${apt.service.name}`,
      });
      return { charged: intent.status === 'succeeded', feeCents, reason: intent.status };
    } catch {
      return { charged: false, feeCents, reason: 'charge_failed' };
    }
  }
}
