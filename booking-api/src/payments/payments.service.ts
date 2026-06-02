import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
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
    const customer = await this.ensureCustomer(apt.clientId);

    if (b.requireDeposit) {
      const depositCents = Math.max(50, Math.round(apt.service.priceCents * (b.depositPercent / 100)));
      const intent = await this.getStripe().paymentIntents.create({
        amount: depositCents,
        currency: 'usd',
        customer,
        setup_future_usage: 'off_session', // save the card for a possible no-show charge
        // Card-only: no redirect-based methods, so the client can confirm without
        // supplying a return_url.
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { appointmentId, businessId, kind: 'deposit' },
        description: `Deposit — ${apt.service.name} @ ${b.name}`,
      });
      await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: { stripePaymentIntentId: intent.id, depositCents },
      });
      return { required: true, mode: 'payment' as const, clientSecret: intent.client_secret, amountCents: depositCents, publishableKey: this.publishableKey() };
    }

    if (b.noShowFeeCents > 0) {
      const intent = await this.getStripe().setupIntents.create({
        customer,
        usage: 'off_session',
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { appointmentId, businessId, kind: 'card_on_file' },
      });
      return { required: true, mode: 'setup' as const, clientSecret: intent.client_secret, amountCents: 0, publishableKey: this.publishableKey() };
    }

    return { required: false, mode: 'none' as const };
  }

  // Owner-initiated deposit (kept for dashboard use); same logic, ownership checked
  // by the controller passing the business.
  async createDepositIntent(appointmentId: string, businessId: string) {
    return this.createBookingIntent(appointmentId, businessId);
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';

    // Deferred until a real "whsec_..." secret is set: safe no-op (returns 200 so
    // Stripe doesn't retry-storm). Set STRIPE_WEBHOOK_SECRET to enable.
    if (!webhookSecret.startsWith('whsec_')) {
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
        const appointmentId = intent.metadata.appointmentId;
        if (appointmentId) {
          await this.prisma.appointment.updateMany({
            where: { id: appointmentId, stripePaymentIntentId: intent.id },
            data: { status: 'CANCELLED' },
          });
        }
        break;
      }
    }

    return { received: true, eventId: event.id };
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
      off_session: true,
      confirm: true,
      metadata: { appointmentId, businessId, kind: 'no_show_fee' },
      description: `No-show fee — ${apt.service.name} @ ${apt.business.name}`,
    });

    await this.prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'NO_SHOW' } });
    return { charged: intent.status === 'succeeded', feeCents, paymentIntentId: intent.id, status: intent.status };
  }
}
