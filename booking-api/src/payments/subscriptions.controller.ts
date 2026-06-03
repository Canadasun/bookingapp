import { Controller, Get, Post, Body, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

const CheckoutSchema = z.object({ plan: z.enum(['BASIC', 'PRO']) });

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
  checkout(@Body() body: unknown, @CurrentUser() user: { businessId: string | null }) {
    const parsed = CheckoutSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('A valid plan (BASIC or PRO) is required');
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.payments.createSubscriptionCheckout(user.businessId, parsed.data.plan);
  }

  // Owner/Admin — open the Stripe billing portal.
  @Post('portal')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  portal(@CurrentUser() user: { businessId: string | null }) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.payments.createBillingPortal(user.businessId);
  }
}
