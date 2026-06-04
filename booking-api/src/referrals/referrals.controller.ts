import { Controller, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('referrals')
@ApiBearerAuth()
@Controller('referrals')
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(private svc: ReferralsService) {}

  // The current business's referral code + the businesses they've referred.
  @Get()
  get(@CurrentUser() user: { businessId: string | null }) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.svc.getMyReferrals(user.businessId);
  }
}
