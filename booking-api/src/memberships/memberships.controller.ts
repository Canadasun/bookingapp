import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MembershipsService } from './memberships.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUser = { id: string; role: string; businessId: string | null };
function assertOwns(user: AuthUser, businessId: string) {
  if (user.role !== 'ADMIN' && user.businessId !== businessId) throw new ForbiddenException();
}

@ApiTags('memberships')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses/:businessId/memberships')
export class MembershipsController {
  constructor(private svc: MembershipsService) {}

  // Plans
  @Get('plans') listPlans(@Param('businessId') biz: string, @CurrentUser() u: AuthUser) { assertOwns(u, biz); return this.svc.listPlans(biz); }
  @Post('plans') createPlan(@Param('businessId') biz: string, @CurrentUser() u: AuthUser, @Body() dto: any) { assertOwns(u, biz); return this.svc.createPlan(biz, dto); }
  @Patch('plans/:id') updatePlan(@Param('businessId') biz: string, @Param('id') id: string, @CurrentUser() u: AuthUser, @Body() dto: any) { assertOwns(u, biz); return this.svc.updatePlan(biz, id, dto); }
  @Delete('plans/:id') deletePlan(@Param('businessId') biz: string, @Param('id') id: string, @CurrentUser() u: AuthUser) { assertOwns(u, biz); return this.svc.deletePlan(biz, id); }

  // Members
  @Get('members') listMembers(@Param('businessId') biz: string, @CurrentUser() u: AuthUser) { assertOwns(u, biz); return this.svc.listMembers(biz); }
  @Post('subscribe') subscribe(@Param('businessId') biz: string, @CurrentUser() u: AuthUser, @Body() dto: { clientId: string; planId: string }) { assertOwns(u, biz); return this.svc.subscribe(biz, dto.clientId, dto.planId); }
  @Patch(':id/cancel') cancel(@Param('businessId') biz: string, @Param('id') id: string, @CurrentUser() u: AuthUser) { assertOwns(u, biz); return this.svc.cancel(biz, id); }
  @Get('clients/:clientId') clientMemberships(@Param('businessId') biz: string, @Param('clientId') cid: string, @CurrentUser() u: AuthUser) { assertOwns(u, biz); return this.svc.clientMemberships(biz, cid); }
}
