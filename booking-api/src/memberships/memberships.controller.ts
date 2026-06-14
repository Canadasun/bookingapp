import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { MembershipsService } from './memberships.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const CreatePlanSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  priceMonthly: z.number().positive().finite(),
});
const UpdatePlanSchema = CreatePlanSchema.partial().extend({ active: z.boolean().optional() });
const SubscribeSchema = z.object({ clientId: z.string().cuid(), planId: z.string().cuid() });

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
  @Post('plans') createPlan(@Param('businessId') biz: string, @CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(CreatePlanSchema)) dto: z.infer<typeof CreatePlanSchema>) { assertOwns(u, biz); return this.svc.createPlan(biz, dto); }
  @Patch('plans/:id') updatePlan(@Param('businessId') biz: string, @Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(UpdatePlanSchema)) dto: z.infer<typeof UpdatePlanSchema>) { assertOwns(u, biz); return this.svc.updatePlan(biz, id, dto); }
  @Delete('plans/:id') deletePlan(@Param('businessId') biz: string, @Param('id') id: string, @CurrentUser() u: AuthUser) { assertOwns(u, biz); return this.svc.deletePlan(biz, id); }

  // Members
  @Get('members') listMembers(@Param('businessId') biz: string, @CurrentUser() u: AuthUser) { assertOwns(u, biz); return this.svc.listMembers(biz); }
  @Post('subscribe') subscribe(@Param('businessId') biz: string, @CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(SubscribeSchema)) dto: z.infer<typeof SubscribeSchema>) { assertOwns(u, biz); return this.svc.subscribe(biz, dto.clientId, dto.planId); }
  @Patch(':id/cancel') cancel(@Param('businessId') biz: string, @Param('id') id: string, @CurrentUser() u: AuthUser) { assertOwns(u, biz); return this.svc.cancel(biz, id); }
  @Get('clients/:clientId') clientMemberships(@Param('businessId') biz: string, @Param('clientId') cid: string, @CurrentUser() u: AuthUser) { assertOwns(u, biz); return this.svc.clientMemberships(biz, cid); }
}
