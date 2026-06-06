import {
  Controller, Get, Post, Param, Body, Headers, RawBodyRequest, Req, UseGuards, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const BookingIntentSchema = z.object({
  appointmentId: z.string().min(1),
  businessId: z.string().min(1),
});

// Complete a booking payment with the card token from the Square Web Payments SDK.
const ChargeBookingSchema = z.object({
  appointmentId: z.string().min(1),
  businessId: z.string().min(1),
  sourceId: z.string().min(1),                 // Square card token (nonce)
  verificationToken: z.string().optional(),    // SCA / buyer verification token
  mode: z.enum(['payment', 'setup']),
});

const CustomChargeSchema = z.object({
  // $0.50 min up to $100,000 per charge. amountCents is the full total
  // (subtotal + tax + tip); tip/tax are the breakdown for the receipt.
  amountCents: z.number().int().min(50).max(10_000_000),
  sourceId: z.string().min(1),                 // Square card token from the in-app/web SDK
  verificationToken: z.string().optional(),
  tipCents: z.number().int().min(0).max(10_000_000).optional(),
  taxCents: z.number().int().min(0).max(10_000_000).optional(),
  description: z.string().max(200).optional(),
  clientId: z.string().optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

const RefundSchema = z.object({
  // Omit amountCents for a full refund of the remaining balance.
  amountCents: z.number().int().positive().optional(),
  reason: z.string().max(200).optional(),
});

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentService: PaymentsService) {}

  // Public — the unauthenticated booking wizard collects the deposit / card-on-file
  // for a just-created PENDING appointment. Scoped to the appointment's business.
  @Post('booking-intent')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  bookingIntent(@Body() body: unknown) {
    const parsed = BookingIntentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('appointmentId and businessId are required');
    return this.paymentService.createBookingIntent(parsed.data.appointmentId, parsed.data.businessId);
  }

  // Public — complete the booking payment (Square charges the tokenized card
  // server-side). Scoped to the appointment's business.
  @Post('charge-booking')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  chargeBooking(@Body() body: unknown) {
    const parsed = ChargeBookingSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('appointmentId, businessId, sourceId and mode are required');
    return this.paymentService.chargeBooking(parsed.data.appointmentId, parsed.data.businessId, {
      sourceId: parsed.data.sourceId,
      verificationToken: parsed.data.verificationToken,
      mode: parsed.data.mode,
    });
  }

  // Owner-initiated deposit (dashboard). Scoped to the owner's business.
  @Post('deposit/:appointmentId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  createDeposit(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.paymentService.createDepositIntent(appointmentId, user.businessId);
  }

  @Post('no-show/:appointmentId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  chargeNoShow(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.paymentService.chargeNoShowFee(appointmentId, user.businessId);
  }

  // In-person custom charge (mobile Checkout → Tap to Pay). Scoped to the owner's business.
  @Post('charge')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  createCharge(
    @Body() body: unknown,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    const parsed = CustomChargeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('A valid amountCents (>= 50) is required');
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.paymentService.createCustomCharge(user.businessId, parsed.data);
  }

  // The business payment ledger (deposits, fees, in-person charges + refunds).
  // Owner/admin always; staff need the VIEW_MONEY permission.
  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('VIEW_MONEY')
  list(@CurrentUser() user: { role: string; businessId: string | null }) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.paymentService.listPayments(user.businessId);
  }

  // Owner — refund a payment (full or partial). Scoped to the owner's business.
  @Post(':paymentId/refund')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  refund(
    @Param('paymentId') paymentId: string,
    @Body() body: unknown,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    const parsed = RefundSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid refund request');
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.paymentService.refundPayment(user.businessId, paymentId, parsed.data);
  }

  // Stripe webhook — retained for SaaS subscription events during the migration.
  @Post('webhook/stripe')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    return this.paymentService.handleWebhook(req.rawBody!, sig);
  }

  // Square webhook — payment + refund reconciliation. Signature is validated over
  // (notificationUrl + rawBody), so we reconstruct the exact URL Square called.
  @Post('webhook/square')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  squareWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-square-hmacsha256-signature') sig: string,
  ) {
    const base = (process.env.API_PUBLIC_URL ?? 'https://bookingapp-production-32f8.up.railway.app').replace(/\/+$/, '').replace(/\/api$/, '');
    return this.paymentService.handleSquareWebhook(req.rawBody!, sig, `${base}/api/payments/webhook/square`);
  }
}
