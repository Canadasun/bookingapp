import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { TasksService } from './tasks.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUser = { id: string; role: string; businessId: string | null };

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  staffId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional(),
  dueAt: z.string().datetime().optional(),
});
const UpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  staffId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  status: z.enum(['OPEN', 'DONE']).optional(),
});

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses/:businessId/tasks')
export class TasksController {
  constructor(private svc: TasksService) {}

  private assertAccess(user: AuthUser, businessId: string) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
  }
  private assertOwner(user: AuthUser) {
    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      throw new ForbiddenException('Only the owner can manage tasks');
    }
  }

  @Get()
  list(@Param('businessId') businessId: string, @CurrentUser() user: AuthUser) {
    this.assertAccess(user, businessId);
    return this.svc.list(businessId, user);
  }

  @Post()
  create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateSchema)) dto: z.infer<typeof CreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertAccess(user, businessId);
    this.assertOwner(user);
    return this.svc.create(businessId, dto);
  }

  // Owners edit anything; staff may only flip their own task's status.
  @Patch(':id')
  update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSchema)) dto: z.infer<typeof UpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertAccess(user, businessId);
    return this.svc.update(businessId, id, user, dto);
  }

  @Delete(':id')
  remove(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assertAccess(user, businessId);
    this.assertOwner(user);
    return this.svc.remove(businessId, id);
  }
}
