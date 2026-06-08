import {
  Controller, Get, Post, Param, Body, Headers, RawBodyRequest, Req, UseGuards, ForbiddenException, BadRequestException, Query,
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

const CustomChargeSchema = z.object({
  // $0.50 min (Stripe) up to $100,000 per charge. amountCents is the full total
  // (subtotal + tax + tip); tip/tax are the breakdown for the receipt.
  amountCents: z.number().int().min(50).max(10_000_000),
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

  // In-person custom charge (mobile Checkout → Stripe PaymentSheet). Scoped to the owner's business.
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

  @Post('webhook/stripe')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    return this.paymentService.handleWebhook(req.rawBody!, sig);
  }

  // ── Stripe Connect Express (business payouts) ────────────────────────────────

  /** Start or resume Stripe Connect onboarding; returns the account-link URL. */
  @Post('connect/onboard')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  connectOnboard(@CurrentUser() user: { role: string; businessId: string | null }) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.paymentService.getConnectOnboardingUrl(user.businessId);
  }

  /** Return the Connect account status and available/pending balance. */
  @Get('connect/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  connectStatus(@CurrentUser() user: { role: string; businessId: string | null }) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.paymentService.getConnectStatus(user.businessId);
  }

  /** Open the Stripe Express dashboard (login link). */
  @Post('connect/dashboard')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  connectDashboard(@CurrentUser() user: { role: string; businessId: string | null }) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.paymentService.getConnectDashboardUrl(user.businessId);
  }

  /** Trigger a manual or instant payout to the business's linked bank / debit card. */
  @Post('connect/payout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  connectPayout(
    @Body() body: unknown,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    const parsed = z.object({
      amountCents: z.number().int().min(100),
      currency: z.string().length(3).optional(),
      instant: z.boolean().optional(),
    }).safeParse(body);
    if (!parsed.success) throw new BadRequestException('amountCents (>= 100) is required');
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.paymentService.createConnectPayout(user.businessId, parsed.data);
  }
}
