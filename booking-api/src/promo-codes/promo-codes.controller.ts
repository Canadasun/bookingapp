import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PromoCodesService } from './promo-codes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUser = { id: string; role: string; businessId: string | null };
function assertOwns(user: AuthUser, businessId: string) {
  if (user.role !== 'ADMIN' && user.businessId !== businessId) throw new ForbiddenException();
}

@ApiTags('promo-codes')
@Controller('businesses/:businessId/promo-codes')
export class PromoCodesController {
  constructor(private svc: PromoCodesService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  list(@Param('businessId') businessId: string, @CurrentUser() user: AuthUser) {
    assertOwns(user, businessId);
    return this.svc.list(businessId);
  }

  // Public — booking page calls this to validate a code without auth
  @Get('validate')
  validate(
    @Param('businessId') businessId: string,
    @Query('code') code: string,
    @Query('priceCents') priceCents: string,
  ) {
    return this.svc.validate(businessId, code, parseInt(priceCents ?? '0', 10));
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(@Param('businessId') businessId: string, @CurrentUser() user: AuthUser, @Body() dto: any) {
    assertOwns(user, businessId);
    return this.svc.create(businessId, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: any) {
    assertOwns(user, businessId);
    return this.svc.update(businessId, id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  remove(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    assertOwns(user, businessId);
    return this.svc.remove(businessId, id);
  }
}
