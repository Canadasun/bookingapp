import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OffersService } from './offers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUser = { id: string; role: string; businessId: string | null };
function assertOwnsBusiness(user: AuthUser, businessId: string) {
  if (user.role !== 'ADMIN' && user.businessId !== businessId) {
    throw new ForbiddenException('You do not have access to this business');
  }
}

const OfferSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  imageUrl: z.string().url().optional(),
  discount: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  active: z.boolean().default(true),
});
type OfferDto = z.infer<typeof OfferSchema>;

@ApiTags('offers')
@Controller('businesses/:businessId/offers')
export class OffersController {
  constructor(private svc: OffersService) {}

  // Public — clients/booking page can read active offers
  @Get()
  list(@Param('businessId') businessId: string) {
    return this.svc.list(businessId);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  create(
    @Param('businessId') businessId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(OfferSchema)) dto: OfferDto,
  ) {
    assertOwnsBusiness(user, businessId);
    return this.svc.create(businessId, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(OfferSchema.partial())) dto: Partial<OfferDto>,
  ) {
    assertOwnsBusiness(user, businessId);
    return this.svc.update(businessId, id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  remove(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    assertOwnsBusiness(user, businessId);
    return this.svc.remove(businessId, id);
  }
}
