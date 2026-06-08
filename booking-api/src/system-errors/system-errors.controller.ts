import { Controller, Get, Post, Patch, Query, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemErrorsService } from './system-errors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('system-errors')
@ApiBearerAuth()
@Controller('system-errors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SystemErrorsController {
  constructor(private svc: SystemErrorsService) {}

  /** Business owner sees their own errors; ADMIN sees all (pass ?businessId= to filter). */
  @Get()
  @Roles(Role.OWNER, Role.ADMIN)
  list(
    @CurrentUser() user: { role: string; businessId: string | null },
    @Query('resolved') resolved?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
    @Query('businessId') bizIdParam?: string,
  ) {
    const bizId = user.role === 'ADMIN' ? (bizIdParam ?? undefined) : (user.businessId ?? undefined);
    return this.svc.list(bizId, {
      resolved: resolved === undefined ? false : resolved === 'true',
      category: category || undefined,
      limit: limit ? Math.min(parseInt(limit, 10), 500) : 100,
    });
  }

  @Get('counts')
  @Roles(Role.OWNER, Role.ADMIN)
  counts(@CurrentUser() user: { role: string; businessId: string | null }) {
    if (!user.businessId) throw new ForbiddenException('No business');
    return this.svc.counts(user.businessId);
  }

  @Patch(':id/resolve')
  @Roles(Role.OWNER, Role.ADMIN)
  resolve(
    @Param('id') id: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    const bizId = user.role === 'ADMIN' ? undefined : (user.businessId ?? undefined);
    return this.svc.resolve(id, bizId);
  }

  @Post('resolve-all')
  @Roles(Role.OWNER, Role.ADMIN)
  resolveAll(@CurrentUser() user: { role: string; businessId: string | null }) {
    if (!user.businessId) throw new ForbiddenException('No business');
    return this.svc.resolveAll(user.businessId);
  }
}
