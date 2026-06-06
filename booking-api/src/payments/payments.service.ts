import { Injectable, BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentKind, PaymentStatus, PlanTier, SubscriptionStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { createHmac, timingSafeEqual } from 'crypto';
import { isPaidPlan, isProPlan } from '../common/util/plan-features';
import { ReferralsService } from '../referrals/referrals.service';
import { SquareService } from '../square/square.service';

@Injectable()
export class PaymentsService {

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private notifications: NotificationsService,
    private referrals: ReferralsService,
    private square: SquareService,
  ) {}



  // Square currency code (uppercase ISO) for a business; defaults to CAD.
  private currencyOf(b: { currency?: string | null } | null | undefined): string {
    return (b?.currency ?? 'CAD').toUpperCase();
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
    squarePaymentId?: string | null;
    amountCents: number;
    tipCents?: number;
    taxCents?: number;
    kind: PaymentKind;
    status: PaymentStatus;
    description?: string;
    receiptUrl?: string | null;
  }) {
    try {
      await this.prisma.payment.create({ data });
    } catch (err) {
      console.error('[ledger] failed to record payment', err);
    }
  }

  // Get-or-create a Square Customer (on the business's merchant account) for a
  // client, and persist the id so cards can be saved and re-charged later
  // (deposits / no-show protection).
  private async ensureSquareCustomer(businessId: string, clientId: string): Promise<string> {
    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    if (client.squareCustomerId) return client.squareCustomerId;
    const res = await this.square.merchantFetch<{ customer: { id: string } }>(businessId, 'POST', '/v2/customers', {
      given_name: client.name,
      email_address: client.email,
      phone_number: client.phone ?? undefined,
      reference_id: client.id,
    });
    await this.prisma.client.update({ where: { id: clientId }, data: { squareCustomerId: res.customer.id } });
    return res.customer.id;
  }

  // Save a tokenized card on file (Square Cards API) for a customer; returns the
  // stored card id, used for later off-session no-show / late-cancel charges.
  private async saveCard(businessId: string, customerId: string, sourceId: string): Promise<string> {
    const res = await this.square.merchantFetch<{ card: { id: string } }>(businessId, 'POST', '/v2/cards', {
      idempotency_key: this.idempotencyKey(['card', businessId, customerId, sourceId]),
      source_id: sourceId,
      card: { customer_id: customerId },
    });
    return res.card.id;
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
      include: { service: true, business: true },
    });
    if (!apt) throw new BadRequestException('Appointment not found');

    const b = apt.business;
    // Free never collects money at booking. Basic+ can collect deposits; Pro
    // also supports card-on-file protection for later automatic fees.
    if (!isPaidPlan(b.plan)) return { required: false, mode: 'none' as const };

    // Square must be connected for this merchant to take any payment.
    const status = await this.square.status(businessId);
    if (!status.connected) return { required: false, mode: 'none' as const, reason: 'square_not_connected' };
    const applicationId = this.configService.get<string>('SQUARE_APPLICATION_ID') ?? '';
    const locationId = await this.square.locationId(businessId);

    if (b.requireDeposit) {
      const totalPriceCents = apt.totalPriceCents || apt.service.priceCents;
      const depositCents = Math.max(50, Math.round(totalPriceCents * (b.depositPercent / 100)));
      // Square charges server-side from a card token. Return what the Web Payments
      // SDK needs to render the card form; the actual charge runs in chargeBooking().
      return {
        required: true, mode: 'payment' as const, amountCents: depositCents,
        currency: b.currency, applicationId, locationId,
        saveCard: isProPlan(b.plan), // Pro keeps the card for no-show charges
      };
    }

    // Card-on-file (no upfront charge): collect a saveable card when the owner
    // turned on "always collect a card", or (Pro) when a no-show fee is set.
    if (b.collectCardOnFile || (isProPlan(b.plan) && b.noShowFeeCents > 0)) {
      return { required: true, mode: 'setup' as const, amountCents: 0, currency: b.currency, applicationId, locationId };
    }

    return { required: false, mode: 'none' as const };
  }

  // Owner-initiated deposit (kept for dashboard use); same logic, ownership checked
  // by the controller passing the business.
  async createDepositIntent(appointmentId: string, businessId: string) {
    return this.createBookingIntent(appointmentId, businessId);
  }

  /**
   * Complete the booking payment after the client tokenizes their card with the
   * Square Web Payments SDK. `mode:'payment'` charges the deposit (and, for Pro,
   * saves the card for no-show protection); `mode:'setup'` only saves the card.
   * Square is synchronous, so on success we confirm the appointment immediately —
   * no webhook round-trip needed.
   */
  async chargeBooking(
    appointmentId: string,
    businessId: string,
    input: { sourceId: string; verificationToken?: string; mode: 'payment' | 'setup' },
  ) {
    const apt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, businessId },
      include: { service: true, client: true, business: true },
    });
    if (!apt) throw new BadRequestException('Appointment not found');
    const b = apt.business;
    if (!input.sourceId) throw new BadRequestException('Missing card token');
    const customerId = await this.ensureSquareCustomer(businessId, apt.clientId);

    // Card-on-file only (no charge).
    if (input.mode === 'setup') {
      const cardId = await this.saveCard(businessId, customerId, input.sourceId);
      await this.prisma.appointment.update({ where: { id: appointmentId }, data: { squareCardId: cardId } });
      await this.prisma.client.update({ where: { id: apt.clientId }, data: { squareCardId: cardId } });
      return { confirmed: true, charged: false, cardSaved: true };
    }

    // Deposit. For Pro, save the card first so we can charge a no-show fee later,
    // then charge that saved card; otherwise charge the one-time token directly.
    const totalPriceCents = apt.totalPriceCents || apt.service.priceCents;
    const depositCents = Math.max(50, Math.round(totalPriceCents * (b.depositPercent / 100)));
    let cardId: string | null = null;
    if (isProPlan(b.plan)) {
      try { cardId = await this.saveCard(businessId, customerId, input.sourceId); } catch { /* charge token directly */ }
    }
    const res = await this.square.merchantFetch<{ payment: any }>(businessId, 'POST', '/v2/payments', {
      source_id: cardId ?? input.sourceId,
      idempotency_key: this.idempotencyKey(['deposit', businessId, appointmentId, depositCents]),
      amount_money: { amount: depositCents, currency: this.currencyOf(b) },
      location_id: await this.square.locationId(businessId),
      autocomplete: true,
      customer_id: customerId,
      buyer_email_address: apt.client.email,
      reference_id: appointmentId.slice(0, 40),
      note: `Deposit — ${apt.service.name} @ ${b.name}`.slice(0, 500),
      ...(input.verificationToken ? { verification_token: input.verificationToken } : {}),
    });
    const pay = res.payment;
    const ok = pay?.status === 'COMPLETED' || pay?.status === 'APPROVED';
    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        squarePaymentId: pay?.id ?? null, depositCents,
        ...(cardId ? { squareCardId: cardId } : {}),
        ...(ok ? { status: 'CONFIRMED' } : {}),
      },
    });
    await this.recordPayment({
      businessId, appointmentId, clientId: apt.clientId,
      squarePaymentId: pay?.id ?? null, amountCents: depositCents,
      kind: 'DEPOSIT', status: ok ? 'SUCCEEDED' : 'FAILED',
      description: `Deposit — ${apt.service.name}`, receiptUrl: pay?.receipt_url ?? null,
    });
    if (ok) {
      const full = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { client: true, service: true, staff: { include: { user: true } }, business: true },
      });
      if (full) await this.notifications.scheduleReminders(full);
    }
    return { confirmed: ok, charged: ok, squarePaymentId: pay?.id, status: pay?.status };
  }

  /**
   * In-person custom charge (mobile Checkout / Tap to Pay). The reader/SDK
   * tokenizes the card → `sourceId`; we create the Square payment on the
   * business's merchant account so it settles to them and shows on the dashboard.
   */
  async createCustomCharge(
    businessId: string,
    input: { amountCents: number; sourceId: string; verificationToken?: string; tipCents?: number; taxCents?: number; description?: string; clientId?: string; idempotencyKey?: string },
  ) {
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    if (!isPaidPlan(business.plan)) {
      throw new BadRequestException('Manual charges require Basic or Pro.');
    }
    if (!input.sourceId) throw new BadRequestException('Missing card token');
    const chargeClient = input.clientId
      ? await this.prisma.client.findUnique({ where: { id: input.clientId }, select: { email: true } })
      : null;
    const idempotencyKey = input.idempotencyKey?.trim()
      ? this.idempotencyKey(['custom', businessId, input.idempotencyKey.trim()])
      : this.idempotencyKey(['custom', businessId, input.clientId, input.amountCents, input.description?.trim(), Math.floor(Date.now() / 60_000)]);
    const res = await this.square.merchantFetch<{ payment: any }>(businessId, 'POST', '/v2/payments', {
      source_id: input.sourceId,
      idempotency_key: idempotencyKey,
      amount_money: { amount: input.amountCents, currency: this.currencyOf(business) },
      ...(input.tipCents ? { tip_money: { amount: input.tipCents, currency: this.currencyOf(business) } } : {}),
      location_id: await this.square.locationId(businessId),
      autocomplete: true,
      ...(chargeClient?.email ? { buyer_email_address: chargeClient.email } : {}),
      note: (input.description?.trim() || `In-person charge — ${business.name}`).slice(0, 500),
      ...(input.verificationToken ? { verification_token: input.verificationToken } : {}),
    });
    const pay = res.payment;
    const ok = pay?.status === 'COMPLETED' || pay?.status === 'APPROVED';
    await this.recordPayment({
      businessId, clientId: input.clientId ?? null,
      squarePaymentId: pay?.id ?? null, amountCents: input.amountCents,
      tipCents: input.tipCents ?? 0, taxCents: input.taxCents ?? 0,
      kind: 'IN_PERSON', status: ok ? 'SUCCEEDED' : 'FAILED',
      description: input.description?.trim() || `In-person charge`, receiptUrl: pay?.receipt_url ?? null,
    });
    return {
      squarePaymentId: pay?.id,
      amountCents: input.amountCents,
      currency: this.currencyOf(business),
      status: pay?.status,
      receiptUrl: pay?.receipt_url ?? null,
    };
  }


  // ── SaaS subscription billing (Square Subscriptions, platform account) ───────
  private planVariationForPlan(plan: 'BASIC' | 'PRO'): string | null {
    const key = plan === 'BASIC' ? 'SQUARE_PLAN_BASIC' : 'SQUARE_PLAN_PRO';
    return this.configService.get<string>(key) || null;
  }

  private planForVariation(variationId?: string | null): PlanTier {
    if (!variationId) return 'FREE';
    if (variationId === this.configService.get<string>('SQUARE_PLAN_BASIC')) return 'BASIC';
    if (variationId === this.configService.get<string>('SQUARE_PLAN_PRO')) return 'PRO';
    return 'FREE';
  }

  private mapSquareSubStatus(s?: string): SubscriptionStatus {
    switch (s) {
      case 'ACTIVE': return 'ACTIVE';
      case 'PENDING': return 'INCOMPLETE';
      case 'PAUSED': return 'PAST_DUE';
      case 'DEACTIVATED':
      case 'CANCELED': return 'CANCELED';
      default: return 'INCOMPLETE';
    }
  }

  // Reconcile our Subscription + Business.plan from a Square subscription object.
  async applySquareSubscription(businessId: string, sub: any) {
    const variationId = sub?.plan_variation_id ?? null;
    const status = this.mapSquareSubStatus(sub?.status);
    const customerId = sub?.customer_id ?? null;
    const periodEnd = sub?.charged_through_date ? new Date(sub.charged_through_date) : null;
    // Only an active subscription grants the paid tier; anything else falls to FREE.
    const effectivePlan: PlanTier = status === 'ACTIVE' || status === 'TRIALING' ? this.planForVariation(variationId) : 'FREE';
    const data = {
      squareCustomerId: customerId,
      squareSubscriptionId: sub?.id ?? null,
      squarePlanVariationId: variationId,
      plan: effectivePlan,
      status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: !!sub?.canceled_date,
    };
    const prev = await this.prisma.business.findUnique({ where: { id: businessId }, select: { plan: true } });
    await this.prisma.subscription.upsert({ where: { businessId }, create: { businessId, ...data }, update: data });
    await this.prisma.business.update({ where: { id: businessId }, data: { plan: effectivePlan, planExpiresAt: periodEnd } });
    if (prev && prev.plan !== effectivePlan) {
      await this.notifications.sendPlanChanged(businessId, effectivePlan).catch(() => {});
    }
    if (effectivePlan !== 'FREE') {
      await this.grantReferralReward(businessId).catch(() => {});
    }
  }

  // Referral reward: Square has no customer-balance credit, so we mark the reward
  // claimed (REWARDED); applying the actual discount is a future enhancement.
  // Gated by REFERRAL_REWARD_CENTS (0 = off, the current default).
  private async grantReferralReward(referredBusinessId: string) {
    const rewardCents = parseInt(this.configService.get<string>('REFERRAL_REWARD_CENTS') ?? '0', 10);
    if (!rewardCents || rewardCents <= 0) return;
    await this.referrals.claimPendingReward(referredBusinessId).catch(() => null);
  }

  // Get-or-create a Square Customer on the PLATFORM account for a business.
  private async ensureBusinessCustomer(business: { id: string; name: string; email: string }): Promise<string> {
    const sub = await this.prisma.subscription.findUnique({ where: { businessId: business.id } });
    if (sub?.squareCustomerId) return sub.squareCustomerId;
    const res = await this.square.platformFetch<{ customer: { id: string } }>('POST', '/v2/customers', {
      given_name: business.name,
      email_address: business.email,
      reference_id: business.id,
    });
    await this.prisma.subscription.upsert({
      where: { businessId: business.id },
      create: { businessId: business.id, squareCustomerId: res.customer.id, plan: 'FREE' },
      update: { squareCustomerId: res.customer.id },
    });
    return res.customer.id;
  }

  // Owner — subscribe to (or switch) a paid plan. The card is tokenized client-side
  // (Square Web Payments SDK) and billed on Pulse's platform Square account.
  async subscribeToPlan(businessId: string, plan: 'BASIC' | 'PRO', sourceId: string, referralCode?: string) {
    const planVariationId = this.planVariationForPlan(plan);
    if (!planVariationId) throw new BadRequestException(`The ${plan} plan is not available for purchase yet.`);
    if (!sourceId) throw new BadRequestException('Missing card token');
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    const customerId = await this.ensureBusinessCustomer(business);

    // Save the card on file (platform account) so the subscription can bill it.
    const cardRes = await this.square.platformFetch<{ card: { id: string } }>('POST', '/v2/cards', {
      idempotency_key: this.idempotencyKey(['sub-card', businessId, sourceId]),
      source_id: sourceId,
      card: { customer_id: customerId },
    });
    const cardId = cardRes.card.id;

    if (referralCode?.trim()) {
      await this.referrals.recordReferral(businessId, referralCode).catch(() => false);
    }

    // Already subscribed? Swap the plan variation in place; else create a new one.
    const existing = await this.prisma.subscription.findUnique({ where: { businessId } });
    if (existing?.squareSubscriptionId && ['ACTIVE', 'PAST_DUE', 'TRIALING'].includes(existing.status ?? '')) {
      try {
        const swapped = await this.square.platformFetch<{ subscription: any }>('POST', `/v2/subscriptions/${existing.squareSubscriptionId}/swap-plan`, {
          new_plan_variation_id: planVariationId,
        });
        await this.applySquareSubscription(businessId, swapped.subscription);
        return { updated: true as const, plan };
      } catch { /* fall through to a fresh subscription */ }
    }

    const created = await this.square.platformFetch<{ subscription: any }>('POST', '/v2/subscriptions', {
      idempotency_key: this.idempotencyKey(['sub', businessId, plan]),
      location_id: this.square.platformLocationId(),
      plan_variation_id: planVariationId,
      customer_id: customerId,
      card_id: cardId,
    });
    await this.applySquareSubscription(businessId, created.subscription);
    return { created: true as const, plan };
  }

  // Owner — cancel the Square subscription.
  async cancelSubscription(businessId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    if (!sub?.squareSubscriptionId) throw new BadRequestException('No active subscription to cancel.');
    const res = await this.square.platformFetch<{ subscription: any }>('POST', `/v2/subscriptions/${sub.squareSubscriptionId}/cancel`, {});
    await this.applySquareSubscription(businessId, res.subscription);
    return { canceled: true };
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
      hasBilling: !!sub?.squareCustomerId,
      // For the billing card form (Square Web Payments SDK, platform account).
      applicationId: this.configService.get<string>('SQUARE_APPLICATION_ID') ?? '',
      locationId: this.square.platformLocationId(),
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
    if (!payment.squarePaymentId) {
      throw new BadRequestException('This payment has no Square charge to refund');
    }
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { currency: true } });
    const remaining = payment.amountCents - payment.refundedCents;
    const amount = input.amountCents ?? remaining;
    if (amount <= 0 || amount > remaining) {
      throw new BadRequestException(`Refund amount must be between 1 and ${remaining} cents`);
    }

    const res = await this.square.merchantFetch<{ refund: any }>(businessId, 'POST', '/v2/refunds', {
      idempotency_key: this.idempotencyKey(['refund', businessId, payment.id, amount, payment.refundedCents, input.reason?.trim()]),
      payment_id: payment.squarePaymentId,
      amount_money: { amount, currency: this.currencyOf(business) },
      ...(input.reason ? { reason: input.reason.slice(0, 192) } : {}),
    });
    const squareRefund = res.refund;
    const refundStatus = (s?: string): 'SUCCEEDED' | 'FAILED' | 'PENDING' =>
      s === 'COMPLETED' ? 'SUCCEEDED' : s === 'FAILED' || s === 'REJECTED' ? 'FAILED' : 'PENDING';

    const refundedTotal = payment.refundedCents + amount;
    const newStatus: PaymentStatus = refundedTotal >= payment.amountCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    const [refund] = await this.prisma.$transaction([
      this.prisma.refund.create({
        data: {
          businessId, paymentId: payment.id, squareRefundId: squareRefund?.id,
          amountCents: amount, reason: input.reason,
          status: refundStatus(squareRefund?.status),
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
    if (!isProPlan(apt.business.plan)) {
      await this.prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'NO_SHOW' } });
      return { charged: false, feeCents: 0, message: 'Marked NO_SHOW. Automatic no-show charging requires Pro; collect manually on Basic.' };
    }

    const feeCents = apt.business.noShowFeeCents > 0
      ? apt.business.noShowFeeCents
      : Math.round((apt.totalPriceCents || apt.service.priceCents) * 0.5); // fallback: 50% of appointment price

    if (!apt.client.squareCustomerId || !apt.squareCardId) {
      // No saved card — can't auto-charge; mark NO_SHOW for manual collection.
      await this.prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'NO_SHOW' } });
      return { charged: false, feeCents, message: 'Marked NO_SHOW. No saved card on file — collect the fee manually.' };
    }

    const res = await this.square.merchantFetch<{ payment: any }>(businessId, 'POST', '/v2/payments', {
      source_id: apt.squareCardId, // saved card on file
      idempotency_key: this.idempotencyKey(['no-show', businessId, appointmentId, feeCents]),
      amount_money: { amount: feeCents, currency: this.currencyOf(apt.business) },
      location_id: await this.square.locationId(businessId),
      autocomplete: true,
      customer_id: apt.client.squareCustomerId,
      buyer_email_address: apt.client.email,
      reference_id: appointmentId.slice(0, 40),
      note: `No-show fee — ${apt.service.name} @ ${apt.business.name}`.slice(0, 500),
    });
    const pay = res.payment;
    const ok = pay?.status === 'COMPLETED' || pay?.status === 'APPROVED';

    await this.prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'NO_SHOW' } });
    await this.recordPayment({
      businessId, appointmentId, clientId: apt.clientId,
      squarePaymentId: pay?.id ?? null, amountCents: feeCents,
      kind: 'NO_SHOW_FEE', status: ok ? 'SUCCEEDED' : 'FAILED',
      description: `No-show fee — ${apt.service.name}`, receiptUrl: pay?.receipt_url ?? null,
    });
    return { charged: ok, feeCents, squarePaymentId: pay?.id, status: pay?.status };
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
    if (!apt.client.squareCustomerId || !apt.squareCardId) {
      return { charged: false, feeCents, reason: 'no_card' };
    }
    try {
      const res = await this.square.merchantFetch<{ payment: any }>(businessId, 'POST', '/v2/payments', {
        source_id: apt.squareCardId,
        idempotency_key: this.idempotencyKey(['late-cancel', businessId, appointmentId, feeCents]),
        amount_money: { amount: feeCents, currency: this.currencyOf(apt.business) },
        location_id: await this.square.locationId(businessId),
        autocomplete: true,
        customer_id: apt.client.squareCustomerId,
        buyer_email_address: apt.client.email,
        reference_id: appointmentId.slice(0, 40),
        note: `Late cancellation fee — ${apt.service.name} @ ${apt.business.name}`.slice(0, 500),
      });
      const pay = res.payment;
      const ok = pay?.status === 'COMPLETED' || pay?.status === 'APPROVED';
      await this.recordPayment({
        businessId, appointmentId, clientId: apt.clientId,
        squarePaymentId: pay?.id ?? null, amountCents: feeCents,
        kind: 'LATE_CANCEL_FEE', status: ok ? 'SUCCEEDED' : 'FAILED',
        description: `Late cancellation fee — ${apt.service.name}`, receiptUrl: pay?.receipt_url ?? null,
      });
      return { charged: ok, feeCents, reason: pay?.status };
    } catch {
      return { charged: false, feeCents, reason: 'charge_failed' };
    }
  }

  // ── Client card-on-file management (portal) ─────────────────────────────────
  // Does this client (matched by email across their records) have a saved card?
  async clientCardStatus(email: string) {
    const clients = await this.prisma.client.findMany({ where: { email }, select: { id: true } });
    const clientIds = clients.map((c) => c.id);
    if (!clientIds.length) return { hasCard: false };
    const count = await this.prisma.appointment.count({
      where: { clientId: { in: clientIds }, squareCardId: { not: null } },
    });
    return { hasCard: count > 0 };
  }

  // Client-initiated: disable every saved Square card (on each owning merchant
  // account) and clear it from their records, so it can no longer be auto-charged
  // (no-show/late-cancel) or manually charged. Best-effort; always clears the refs.
  async removeClientCards(email: string) {
    const clients = await this.prisma.client.findMany({ where: { email }, select: { id: true } });
    const clientIds = clients.map((c) => c.id);
    if (!clientIds.length) return { removed: 0 };
    const appts = await this.prisma.appointment.findMany({
      where: { clientId: { in: clientIds }, squareCardId: { not: null } },
      select: { squareCardId: true, businessId: true },
    });
    const seen = new Set<string>();
    let removed = 0;
    for (const a of appts) {
      if (!a.squareCardId || seen.has(`${a.businessId}:${a.squareCardId}`)) continue;
      seen.add(`${a.businessId}:${a.squareCardId}`);
      try { await this.square.merchantFetch(a.businessId, 'POST', `/v2/cards/${a.squareCardId}/disable`); removed++; } catch { /* already disabled / not connected */ }
    }
    await this.prisma.appointment.updateMany({ where: { clientId: { in: clientIds } }, data: { squareCardId: null } });
    await this.prisma.client.updateMany({ where: { id: { in: clientIds } }, data: { squareCardId: null } });
    return { removed };
  }

  // ── Square webhook (payment + refund reconciliation) ────────────────────────
  // Square charges are synchronous, so this mainly reconciles async refunds and
  // out-of-band changes (e.g. a refund issued from the Square dashboard).
  async handleSquareWebhook(rawBody: Buffer, signature: string, notificationUrl: string) {
    const key = this.configService.get<string>('SQUARE_WEBHOOK_SIGNATURE_KEY') ?? '';
    if (!key) {
      if (process.env.NODE_ENV === 'production') throw new ServiceUnavailableException('Square webhook signature key not configured');
      return { received: true, skipped: 'square webhook not configured' };
    }
    // Square signs HMAC-SHA256 of (notificationUrl + rawBody), base64.
    const expected = createHmac('sha256', key).update(notificationUrl + rawBody.toString('utf8')).digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature ?? '');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid Square webhook signature');
    }
    let event: any;
    try { event = JSON.parse(rawBody.toString('utf8')); } catch { throw new BadRequestException('Invalid Square webhook body'); }
    const type: string = event?.type ?? '';

    if (type === 'refund.created' || type === 'refund.updated') {
      const refund = event?.data?.object?.refund;
      const paymentId = refund?.payment_id;
      if (paymentId) {
        const payment = await this.prisma.payment.findUnique({ where: { squarePaymentId: paymentId } });
        if (payment && refund?.id) {
          const status: 'SUCCEEDED' | 'FAILED' | 'PENDING' = refund.status === 'COMPLETED' ? 'SUCCEEDED' : refund.status === 'FAILED' || refund.status === 'REJECTED' ? 'FAILED' : 'PENDING';
          await this.prisma.refund.upsert({
            where: { squareRefundId: refund.id },
            update: { status },
            create: { businessId: payment.businessId, paymentId: payment.id, squareRefundId: refund.id, amountCents: refund.amount_money?.amount ?? 0, status },
          });
          const refundedCents = (await this.prisma.refund.aggregate({ where: { paymentId: payment.id, status: 'SUCCEEDED' }, _sum: { amountCents: true } }))._sum.amountCents ?? 0;
          const pStatus: PaymentStatus = refundedCents >= payment.amountCents ? 'REFUNDED' : refundedCents > 0 ? 'PARTIALLY_REFUNDED' : payment.status;
          await this.prisma.payment.update({ where: { id: payment.id }, data: { refundedCents, status: pStatus } });
        }
      }
    } else if (type === 'payment.updated' || type === 'payment.created') {
      const sqPay = event?.data?.object?.payment;
      if (sqPay?.id) {
        const ok = sqPay.status === 'COMPLETED' || sqPay.status === 'APPROVED';
        await this.prisma.payment.updateMany({
          where: { squarePaymentId: sqPay.id, status: { in: ['PENDING', 'FAILED'] } },
          data: { status: ok ? 'SUCCEEDED' : sqPay.status === 'FAILED' || sqPay.status === 'CANCELED' ? 'FAILED' : 'PENDING', ...(sqPay.receipt_url ? { receiptUrl: sqPay.receipt_url } : {}) },
        });
      }
    } else if (type === 'subscription.created' || type === 'subscription.updated') {
      // Reconcile SaaS billing when a subscription changes (renewal, cancel, etc.).
      const sqSub = event?.data?.object?.subscription;
      if (sqSub?.id) {
        const row = await this.prisma.subscription.findUnique({ where: { squareSubscriptionId: sqSub.id }, select: { businessId: true } });
        if (row) await this.applySquareSubscription(row.businessId, sqSub);
      }
    }
    return { received: true, eventId: event?.event_id ?? null };
  }
}
