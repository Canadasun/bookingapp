import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { MembershipsService } from './memberships.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

const CreatePlanSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  priceMonthly: z.number().positive().finite(),
});
const UpdatePlanSchema = CreatePlanSchema.partial().extend({ active: z.boolean().optional() });
const SubscribeSchema = z.object({ clientId: z.string().cuid(), planId: z.string().cuid() });
const ConfirmSchema = z.object({ sessionId: z.string().trim().min(1).max(255) });

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
  @Post('plans') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.OWNER, Role.ADMIN) createPlan(@Param('businessId') biz: string, @CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(CreatePlanSchema)) dto: z.infer<typeof CreatePlanSchema>) { assertOwns(u, biz); return this.svc.createPlan(biz, dto); }
  @Patch('plans/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.OWNER, Role.ADMIN) updatePlan(@Param('businessId') biz: string, @Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(UpdatePlanSchema)) dto: z.infer<typeof UpdatePlanSchema>) { assertOwns(u, biz); return this.svc.updatePlan(biz, id, dto); }
  @Delete('plans/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.OWNER, Role.ADMIN) deletePlan(@Param('businessId') biz: string, @Param('id') id: string, @CurrentUser() u: AuthUser) { assertOwns(u, biz); return this.svc.deletePlan(biz, id); }

  // Members
  @Get('members') listMembers(@Param('businessId') biz: string, @CurrentUser() u: AuthUser) { assertOwns(u, biz); return this.svc.listMembers(biz); }
  @Post('subscribe') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.OWNER, Role.ADMIN) subscribe(@Param('businessId') biz: string, @CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(SubscribeSchema)) dto: z.infer<typeof SubscribeSchema>) { assertOwns(u, biz); return this.svc.subscribe(biz, dto.clientId, dto.planId); }
  @Post('confirm') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.OWNER, Role.ADMIN) confirm(@Param('businessId') biz: string, @CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(ConfirmSchema)) dto: z.infer<typeof ConfirmSchema>) { assertOwns(u, biz); return this.svc.confirm(biz, dto.sessionId); }
  @Patch(':id/cancel') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.OWNER, Role.ADMIN) cancel(@Param('businessId') biz: string, @Param('id') id: string, @CurrentUser() u: AuthUser) { assertOwns(u, biz); return this.svc.cancel(biz, id); }
  @Get('clients/:clientId') clientMemberships(@Param('businessId') biz: string, @Param('clientId') cid: string, @CurrentUser() u: AuthUser) { assertOwns(u, biz); return this.svc.clientMemberships(biz, cid); }
}
