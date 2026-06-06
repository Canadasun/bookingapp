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

const SubscribeSchema = z.object({
  plan: z.enum(['BASIC', 'PRO']),
  sourceId: z.string().min(1),                 // Square card token (Web Payments SDK)
  referralCode: z.string().trim().max(40).optional(),
});

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

  // Owner/Admin — subscribe to (or switch) a paid plan with a Square card token.
  @Post('subscribe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  subscribe(@Body() body: unknown, @CurrentUser() user: { businessId: string | null }) {
    const parsed = SubscribeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('A valid plan (BASIC or PRO) and card token are required');
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.payments.subscribeToPlan(user.businessId, parsed.data.plan, parsed.data.sourceId, parsed.data.referralCode);
  }

  // Owner/Admin — cancel the subscription.
  @Post('cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  cancel(@CurrentUser() user: { businessId: string | null }) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.payments.cancelSubscription(user.businessId);
  }
}
