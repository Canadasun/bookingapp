import { Controller, Get, Post, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
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
  cadenceDays: z.number().int().positive().max(366).optional().nullable(),
  dueAt: z.string().datetime(),
});
const RescheduleSchema = z.object({
  cadenceDays: z.number().int().positive().max(366).optional().nullable(),
  dueAt: z.string().datetime().optional(),
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
