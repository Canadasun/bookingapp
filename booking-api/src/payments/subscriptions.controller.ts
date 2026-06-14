import { Controller, Get, Post, Body, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

const CheckoutSchema = z.object({ plan: z.enum(['BASIC', 'PRO', 'UNLIMITED']), referralCode: z.string().trim().max(40).optional() });
const ConfirmCheckoutSchema = z.object({ sessionId: z.string().trim().min(1).max(255) });

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private payments: PaymentsService) {}

  // Current plan + billing status — any signed-in business member.
  @Get()
  @UseGuards(JwtAuthGuard)
  get(@CurrentUser() user: { businessId: string | null }) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.payments.getSubscription(user.businessId);
  }

  // Owner/Admin — start a Stripe Checkout to subscribe to a paid plan.
  @Post('checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  checkout(@Body() body: unknown, @CurrentUser() user: { businessId: string | null }) {
    const parsed = CheckoutSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('A valid plan (BASIC or PRO) is required');
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.payments.createSubscriptionCheckout(user.businessId, parsed.data.plan, parsed.data.referralCode);
  }

  // Owner/Admin — verify a completed Checkout Session and activate the plan now,
  // rather than making the returning browser wait for Stripe's webhook delivery.
  @Post('confirm-checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  confirmCheckout(@Body() body: unknown, @CurrentUser() user: { businessId: string | null }) {
    const parsed = ConfirmCheckoutSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('A valid checkout session is required');
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.payments.confirmSubscriptionCheckout(user.businessId, parsed.data.sessionId);
  }

  // Owner/Admin — open the Stripe billing portal.
  @Post('portal')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  portal(@CurrentUser() user: { businessId: string | null }) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.payments.createBillingPortal(user.businessId);
  }
}
