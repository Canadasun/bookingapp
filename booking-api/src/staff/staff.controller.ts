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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
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
  @UseGuards(JwtAuthGuard)
  findAllIncludingInactive(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.staffService.findAllIncludingInactive(businessId);
  }

  // Full staff detail (incl. email) is for the owner dashboard only and scoped to
  // the business. The public booking flow uses GET /staff (names only).
  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.staffService.findOne(id, businessId);
  }

  @Get(':id/time-off')
  getTimeOffs(@Param('id') id: string) {
    return this.staffService.getTimeOffs(id);
  }

  // Owner/Admin only — create a staff member + login with a one-time temp
  // password (returned once). Replaces the old public /auth/register staff path.
  @Post('invite')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  create(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
    @Body(new ZodValidationPipe(CreateStaffSchema)) dto: CreateStaffDto,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.staffService.create(businessId, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  update(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
    @Body(new ZodValidationPipe(UpdateStaffSchema)) dto: UpdateStaffDto,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.staffService.update(id, dto, businessId);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  remove(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.staffService.remove(id, businessId);
  }

  @Post(':id/services')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  assignServices(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
    @Body(new ZodValidationPipe(AssignServicesSchema)) dto: AssignServicesDto,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.staffService.assignServices(id, dto, businessId);
  }

  @Post(':id/availability')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  setAvailability(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
    @Body(new ZodValidationPipe(z.array(AvailabilityRuleSchema))) rules: AvailabilityRuleDto[],
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.staffService.setAvailabilityRules(id, rules, businessId);
  }

  @Post(':id/time-off')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createTimeOff(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
    @Body(new ZodValidationPipe(TimeOffSchema)) dto: TimeOffDto,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.staffService.createTimeOff(id, dto, businessId);
  }

  @Delete(':id/time-off/:timeOffId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  deleteTimeOff(
    @Param('timeOffId') timeOffId: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.staffService.deleteTimeOff(timeOffId, businessId);
  }
}
