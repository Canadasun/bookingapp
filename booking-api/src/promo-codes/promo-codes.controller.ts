import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { PromoCodesService } from './promo-codes.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

const PromoCodeFields = z.object({
  code: z.string().trim().min(1).max(40).regex(/^[A-Z0-9_-]+$/i, 'Code may only contain letters, digits, hyphens, and underscores'),
  discountType: z.enum(['PERCENT', 'FLAT']),
  discountValue: z.number().positive().finite(),
  maxUsages: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  active: z.boolean().optional(),
});
const validatePercent = (value: { discountType?: 'PERCENT' | 'FLAT'; discountValue?: number }, ctx: z.RefinementCtx) => {
  if (value.discountType === 'PERCENT' && value.discountValue !== undefined && value.discountValue > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discountValue'], message: 'Percentage discount cannot exceed 100' });
  }
};
const PromoCodeSchema = PromoCodeFields.superRefine(validatePercent);
const UpdatePromoCodeSchema = PromoCodeFields.partial().superRefine(validatePercent);

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
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
    const price = Number(priceCents);
    if (!Number.isInteger(price) || price < 0 || price > 100_000_000) throw new BadRequestException('Invalid price');
    return this.svc.validate(businessId, code, price);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  create(@Param('businessId') businessId: string, @CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(PromoCodeSchema)) dto: z.infer<typeof PromoCodeSchema>) {
    assertOwns(user, businessId);
    return this.svc.create(businessId, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  update(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(UpdatePromoCodeSchema)) dto: z.infer<typeof UpdatePromoCodeSchema>) {
    assertOwns(user, businessId);
    return this.svc.update(businessId, id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  remove(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    assertOwns(user, businessId);
    return this.svc.remove(businessId, id);
  }
}
