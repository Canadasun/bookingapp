import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { ServiceDueService } from './service-due.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUser = { role: string; businessId: string | null };

const SetSchema = z.object({
  clientId: z.string().min(1),
  serviceId: z.string().optional().nullable(),
  policyId: z.string().optional().nullable(),
  cadenceDays: z.number().int().positive().max(366).optional().nullable(),
  dueAt: z.string().datetime(),
  messageSubject: z.string().max(200).optional().nullable(),
  messageBody: z.string().max(2000).optional().nullable(),
});
const RescheduleSchema = z.object({
  cadenceDays: z.number().int().positive().max(366).optional().nullable(),
  dueAt: z.string().datetime().optional(),
});
const PolicySchema = z.object({
  serviceId: z.string().optional().nullable(),
  name: z.string().min(1).max(100),
  trigger: z.enum(['COMPLETED', 'MANUAL']).default('COMPLETED'),
  delayDays: z.number().int().min(0).max(3660),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  enabled: z.boolean().optional(),
});

@ApiTags('service-due')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN)
@Controller('businesses/:businessId/service-due')
export class ServiceDueController {
  constructor(private svc: ServiceDueService) {}

  private assert(user: AuthUser, businessId: string) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
  }

  @Get()
  list(@Param('businessId') businessId: string, @CurrentUser() user: AuthUser) {
    this.assert(user, businessId);
    return this.svc.list(businessId);
  }

  @Get('policies')
  policies(@Param('businessId') businessId: string, @CurrentUser() user: AuthUser) {
    this.assert(user, businessId);
    return this.svc.listPolicies(businessId);
  }

  @Post('policies')
  createPolicy(@Param('businessId') businessId: string, @Body(new ZodValidationPipe(PolicySchema)) dto: z.infer<typeof PolicySchema>, @CurrentUser() user: AuthUser) {
    this.assert(user, businessId);
    return this.svc.createPolicy(businessId, dto);
  }

  @Patch('policies/:id')
  updatePolicy(@Param('businessId') businessId: string, @Param('id') id: string, @Body(new ZodValidationPipe(PolicySchema.partial())) dto: Partial<z.infer<typeof PolicySchema>>, @CurrentUser() user: AuthUser) {
    this.assert(user, businessId);
    return this.svc.updatePolicy(businessId, id, dto);
  }

  @Delete('policies/:id')
  deletePolicy(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assert(user, businessId);
    return this.svc.deletePolicy(businessId, id);
  }

  @Post()
  setDue(@Param('businessId') businessId: string, @Body(new ZodValidationPipe(SetSchema)) dto: z.infer<typeof SetSchema>, @CurrentUser() user: AuthUser) {
    this.assert(user, businessId);
    return this.svc.setDue(businessId, dto);
  }

  @Post(':id/approve')
  approve(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assert(user, businessId);
    return this.svc.approve(businessId, id);
  }

  @Post(':id/reschedule')
  reschedule(@Param('businessId') businessId: string, @Param('id') id: string, @Body(new ZodValidationPipe(RescheduleSchema)) dto: z.infer<typeof RescheduleSchema>, @CurrentUser() user: AuthUser) {
    this.assert(user, businessId);
    return this.svc.reschedule(businessId, id, dto);
  }

  @Post(':id/cancel')
  cancel(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assert(user, businessId);
    return this.svc.cancel(businessId, id);
  }
}
