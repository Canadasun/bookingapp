import { Controller, Get, Post, Patch, Param, Body, UseGuards, Delete, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import {
  CreateStaffSchema, CreateStaffDto,
  UpdateStaffSchema, UpdateStaffDto,
  AvailabilityRuleSchema, AvailabilityRuleDto,
  TimeOffSchema, TimeOffDto,
  AssignServicesSchema, AssignServicesDto,
  InviteStaffSchema, InviteStaffDto,
} from './dto/staff.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { z } from 'zod';

@ApiTags('staff')
@Controller('businesses/:businessId/staff')
export class StaffController {
  constructor(private staffService: StaffService) {}

  // Public — booking flow needs staff list without auth
  @Get()
  findAll(@Param('businessId') businessId: string) {
    return this.staffService.findAll(businessId);
  }

  @Get('all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('MANAGE_STAFF')
  findAllIncludingInactive(@Param('businessId') businessId: string) {
    return this.staffService.findAllIncludingInactive(businessId);
  }

  // Full staff detail (incl. email) is for the owner dashboard only and scoped to
  // the business. The public booking flow uses GET /staff (names only).
  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('MANAGE_STAFF')
  findOne(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
  ) {
    return this.staffService.findOne(id, businessId);
  }

  @Get(':id/time-off')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  getTimeOffs(@Param('id') id: string, @Param('businessId') businessId: string) {
    return this.staffService.getTimeOffs(id, businessId);
  }

  // Owner/Admin only — create a staff member + login with a one-time temp
  // password (returned once). Replaces the old public /auth/register staff path.
  @Post('invite')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  invite(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
    @Body(new ZodValidationPipe(InviteStaffSchema)) dto: InviteStaffDto,
  ) {
    return this.staffService.invite(businessId, dto, user);
  }

  // Owner/Admin only — and only within their own business.
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateStaffSchema)) dto: CreateStaffDto,
  ) {
    return this.staffService.create(businessId, dto);
  }

  // Owner/admin always; staff with MANAGE_STAFF may edit team profiles — but only
  // owners/admins may change another member's permissions (no privilege escalation).
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('MANAGE_STAFF')
  update(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
    @Body(new ZodValidationPipe(UpdateStaffSchema)) dto: UpdateStaffDto,
  ) {
    if (dto.permissions !== undefined && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      throw new ForbiddenException('Only owners can change staff permissions');
    }
    return this.staffService.update(id, dto, businessId);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  remove(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @Body() body: { force?: boolean },
  ) {
    return this.staffService.remove(id, businessId, { force: body?.force === true });
  }

  @Post(':id/services')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('MANAGE_STAFF')
  assignServices(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(AssignServicesSchema)) dto: AssignServicesDto,
  ) {
    return this.staffService.assignServices(id, dto, businessId);
  }

  @Post(':id/availability')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  setAvailability(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(z.array(AvailabilityRuleSchema))) rules: AvailabilityRuleDto[],
  ) {
    return this.staffService.setAvailabilityRules(id, rules, businessId);
  }

  @Post(':id/time-off')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  createTimeOff(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(TimeOffSchema)) dto: TimeOffDto,
  ) {
    return this.staffService.createTimeOff(id, dto, businessId);
  }

  @Delete(':id/time-off/:timeOffId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  deleteTimeOff(
    @Param('timeOffId') timeOffId: string,
    @Param('businessId') businessId: string,
  ) {
    return this.staffService.deleteTimeOff(timeOffId, businessId);
  }
}
