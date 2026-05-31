import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, PlanTier } from '@prisma/client';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('metrics')
  getMetrics(@Query('timeframe') timeframe: 'today' | 'week' | 'month' = 'week') {
    return this.adminService.getPerformanceMetrics(timeframe);
  }

  @Get('salons')
  getSalons() {
    return this.adminService.getSalons();
  }

  @Patch('salons/:id')
  updateSalon(@Param('id') id: string, @Body() data: { suspended?: boolean; plan?: PlanTier }) {
    return this.adminService.updateSalon(id, data);
  }

  @Get('transactions')
  getTransactions() {
    return this.adminService.getTransactions();
  }

  @Get('health')
  getSystemHealth() {
    return this.adminService.getSystemHealth();
  }

  @Post('salons/:id/impersonate')
  impersonate(@Param('id') id: string) {
    return this.adminService.impersonate(id);
  }
}
