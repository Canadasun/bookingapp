import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { ResourcesService } from './resources.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const CreateResourceSchema = z.object({ name: z.string().trim().min(1).max(80) });
const UpdateResourceSchema = z.object({ name: z.string().trim().min(1).max(80).optional(), active: z.boolean().optional() });

@ApiTags('resources')
@ApiBearerAuth()
@Controller('businesses/:businessId/resources')
export class ResourcesController {
  constructor(private resources: ResourcesService) {}

  private assertBusiness(user: { role: string; businessId: string | null }, businessId: string) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    this.assertBusiness(user, businessId);
    return this.resources.findAll(businessId, true);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('MANAGE_SERVICES')
  create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateResourceSchema)) dto: { name: string },
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    this.assertBusiness(user, businessId);
    return this.resources.create(businessId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('MANAGE_SERVICES')
  update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateResourceSchema)) dto: { name?: string; active?: boolean },
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    this.assertBusiness(user, businessId);
    return this.resources.update(id, businessId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('MANAGE_SERVICES')
  remove(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    this.assertBusiness(user, businessId);
    return this.resources.remove(id, businessId);
  }
}
