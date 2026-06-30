import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WaitlistService } from './waitlist.service';
import { JoinWaitlistSchema, JoinWaitlistDto } from './dto/waitlist.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUser = { id: string; role: string; businessId: string | null };
function assertOwns(user: AuthUser, businessId: string) {
  if (user.role !== 'ADMIN' && user.businessId !== businessId) {
    throw new ForbiddenException('You do not have access to this business');
  }
}

@ApiTags('waitlist')
@Controller('businesses/:businessId/waitlist')
export class WaitlistController {
  constructor(private svc: WaitlistService) {}

  // Public — clients join the waitlist from the booking page when no slot fits.
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  join(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(JoinWaitlistSchema)) dto: JoinWaitlistDto,
  ) {
    return this.svc.join(businessId, dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  list(@Param('businessId') businessId: string, @CurrentUser() user: AuthUser, @Query('locationIds') locationIds?: string) {
    assertOwns(user, businessId);
    return this.svc.list(businessId, locationIds?.split(',').filter(Boolean).slice(0, 5));
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  remove(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    assertOwns(user, businessId);
    return this.svc.remove(businessId, id);
  }
}
