import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GiftCardsService } from './gift-cards.service';
import { IssueGiftCardSchema, IssueGiftCardDto, RedeemGiftCardSchema, RedeemGiftCardDto } from './dto/gift-cards.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('gift-cards')
@Controller('businesses/:businessId/gift-cards')
export class GiftCardsController {
  constructor(private svc: GiftCardsService) {}

  // Public — a client checks their gift card balance by code.
  @Get('balance')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  balance(@Param('businessId') businessId: string, @Query('code') code: string) {
    return this.svc.balance(businessId, code ?? '');
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  list(@Param('businessId') businessId: string) {
    return this.svc.list(businessId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  get(@Param('businessId') businessId: string, @Param('id') id: string) {
    return this.svc.get(businessId, id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  issue(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(IssueGiftCardSchema)) dto: IssueGiftCardDto,
  ) {
    return this.svc.issue(businessId, dto);
  }

  @Post('redeem')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  redeem(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(RedeemGiftCardSchema)) dto: RedeemGiftCardDto,
  ) {
    return this.svc.redeem(businessId, dto);
  }

  @Post(':id/void')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  void(@Param('businessId') businessId: string, @Param('id') id: string) {
    return this.svc.void(businessId, id);
  }
}
