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
  // at boot. Only payment paths (deposits, webhook verification) reach this; if
  // the key is unset they fail with a clear 400 instead of taking down the API.
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

  async createDepositIntent(appointmentId: string, user: { role: string; businessId: string | null }) {
    const apt = await this.prisma.appointment.findFirst({
      where: { 
        id: appointmentId,
        ...(user.role !== 'ADMIN' ? { businessId: user.businessId! } : {})
      },
      include: { service: true, client: true },
    });

    if (!apt) throw new BadRequestException('Appointment not found');

    const depositCents = Math.round(apt.service.priceCents * 0.25); // 25% deposit

    const intent = await this.getStripe().paymentIntents.create({
      amount: depositCents,
      currency: 'usd',
      metadata: { appointmentId },
      description: `Deposit for ${apt.service.name}`,
    });

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { stripePaymentIntentId: intent.id, depositCents },
    });

    return { clientSecret: intent.client_secret, depositCents };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';

    // TODO: re-enable webhook in a later update.
    // Stripe webhooks are deferred for launch. Until a real "whsec_..." signing
    // secret is configured, this endpoint is a safe no-op: it returns 200 (so
    // Stripe never retry-storms) and can't error or block anything. Bookings are
    // confirmed via the owner-approval flow (BookingsService.confirm), not here.
    // Set STRIPE_WEBHOOK_SECRET to a real whsec_ value and full processing
    // (payment_intent.succeeded → CONFIRMED) resumes automatically.
    if (!webhookSecret.startsWith('whsec_')) {
      return { received: true, skipped: 'stripe webhook deferred — not configured' };
    }

    let event: Stripe.Event;
    try {
      event = this.getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    // Idempotency: check if we already processed this event
    const eventId = event.id;

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const appointmentId = intent.metadata.appointmentId;
        if (appointmentId) {
          // Idempotent: only transition (and notify) on the first time we see a
          // success for this intent. Stripe may redeliver the same event.
          const { count } = await this.prisma.appointment.updateMany({
            where: {
              id: appointmentId,
              stripePaymentIntentId: intent.id,
              status: { not: 'CONFIRMED' },
            },
            data: { status: 'CONFIRMED' },
          });
          if (count > 0) {
            // Send the confirmation email + schedule reminders, same as an
            // owner manually confirming the booking.
            const apt = await this.prisma.appointment.findUnique({
              where: { id: appointmentId },
              include: {
                client: true,
                service: true,
                staff: { include: { user: true } },
                business: true,
              },
            });
            if (apt) await this.notifications.scheduleReminders(apt);
          }
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

    return { received: true, eventId };
  }

  async chargeNoShowFee(appointmentId: string, user: { role: string; businessId: string | null }) {
    const apt = await this.prisma.appointment.findFirst({
      where: { 
        id: appointmentId,
        ...(user.role !== 'ADMIN' ? { businessId: user.businessId! } : {})
      },
      include: { service: true },
    });

    if (!apt) throw new BadRequestException('Appointment not found');

    if (!apt.stripePaymentIntentId) {
      throw new BadRequestException('No payment intent on file for this appointment');
    }

    const noShowFeeCents = Math.round(apt.service.priceCents * 0.5);

    // TODO: To auto-charge a no-show fee you need a saved Stripe Customer with an
    // attached payment method. Steps:
    //   1. Add stripeCustomerId to the Client schema field
    //   2. Call stripe.customers.create() at deposit time and store the ID
    //   3. Pass customer + payment_method here with confirm: true
    // For now, mark the appointment NO_SHOW and return the fee amount for manual collection.
    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'NO_SHOW' },
    });

    return { noShowFeeCents, message: 'Appointment marked NO_SHOW. Charge the client manually or implement Stripe Customer flow.' };
  }
}
