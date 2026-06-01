import { Controller, Get, Post, Param, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GiftCardsService } from './gift-cards.service';
import { IssueGiftCardSchema, IssueGiftCardDto, RedeemGiftCardSchema, RedeemGiftCardDto } from './dto/gift-cards.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUser = { id: string; role: string; businessId: string | null };
function assertOwns(user: AuthUser, businessId: string) {
  if (user.role !== 'ADMIN' && user.businessId !== businessId) {
    throw new ForbiddenException('You do not have access to this business');
  }
}

@ApiTags('gift-cards')
@Controller('businesses/:businessId/gift-cards')
export class GiftCardsController {
  constructor(private svc: GiftCardsService) {}

  // Public — a client checks their gift card balance by code.
  @Get('balance')
  balance(@Param('businessId') businessId: string, @Query('code') code: string) {
    return this.svc.balance(businessId, code ?? '');
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  list(@Param('businessId') businessId: string, @CurrentUser() user: AuthUser) {
    assertOwns(user, businessId);
    return this.svc.list(businessId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  get(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    assertOwns(user, businessId);
    return this.svc.get(businessId, id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  issue(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(IssueGiftCardSchema)) dto: IssueGiftCardDto,
    @CurrentUser() user: AuthUser,
  ) {
    assertOwns(user, businessId);
    return this.svc.issue(businessId, dto);
  }

  @Post('redeem')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  redeem(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(RedeemGiftCardSchema)) dto: RedeemGiftCardDto,
    @CurrentUser() user: AuthUser,
  ) {
    assertOwns(user, businessId);
    return this.svc.redeem(businessId, dto);
  }

  @Post(':id/void')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  void(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    assertOwns(user, businessId);
    return this.svc.void(businessId, id);
  }
}
