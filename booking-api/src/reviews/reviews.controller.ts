import { Controller, Get, Post, Patch, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { SubmitReviewSchema, SubmitReviewDto, ModerateReviewSchema, ModerateReviewDto } from './dto/reviews.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUser = { id: string; role: string; businessId: string | null };
function assertOwns(user: AuthUser, businessId: string) {
  if (user.role !== 'ADMIN' && user.businessId !== businessId) {
    throw new ForbiddenException('You do not have access to this business');
  }
}

@ApiTags('reviews')
@Controller('businesses/:businessId/reviews')
export class ReviewsController {
  constructor(private svc: ReviewsService) {}

  // Public — submit (from the post-visit email link).
  @Post()
  submit(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(SubmitReviewSchema)) dto: SubmitReviewDto,
  ) {
    return this.svc.submit(businessId, dto);
  }

  // Public — published reviews + average (booking page).
  @Get()
  list(@Param('businessId') businessId: string) {
    return this.svc.publicList(businessId);
  }

  // Owner — all reviews (incl. hidden).
  @Get('all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  ownerList(@Param('businessId') businessId: string, @CurrentUser() user: AuthUser) {
    assertOwns(user, businessId);
    return this.svc.ownerList(businessId);
  }

  // Owner — show/hide a review.
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  moderate(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(ModerateReviewSchema)) dto: ModerateReviewDto,
  ) {
    assertOwns(user, businessId);
    return this.svc.setPublished(businessId, id, dto.published);
  }
}
