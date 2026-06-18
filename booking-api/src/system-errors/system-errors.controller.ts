import { Controller, Get, Post, Patch, Query, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemErrorsService } from './system-errors.service';
import { JwtAuthGuard, AdminTokenGuard } from '../auth/guards/jwt-auth.guard';
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
  counts(
    @CurrentUser() user: { role: string; businessId: string | null },
    @Query('businessId') bizIdParam?: string,
  ) {
    const bizId = user.role === 'ADMIN' ? bizIdParam : (user.businessId ?? undefined);
    if (!bizId) throw new ForbiddenException('No business — pass ?businessId= to filter');
    return this.svc.counts(bizId);
  }

  @Get('patterns')
  @Roles(Role.ADMIN)
  @UseGuards(AdminTokenGuard)
  patterns() {
    return this.svc.patterns();
  }

  @Get('business-health')
  @Roles(Role.ADMIN)
  @UseGuards(AdminTokenGuard)
  businessHealth(@Query('limit') limit?: string) {
    return this.svc.businessHealth(limit ? Math.min(parseInt(limit, 10), 100) : 20);
  }

  @Patch(':id/resolve')
  @Roles(Role.OWNER, Role.ADMIN)
  resolve(
    @Param('id') id: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && !user.businessId) throw new ForbiddenException('No business on this account');
    const bizId = user.role === 'ADMIN' ? undefined : user.businessId!;
    return this.svc.resolve(id, bizId);
  }

  @Post('resolve-all')
  @Roles(Role.OWNER, Role.ADMIN)
  resolveAll(
    @CurrentUser() user: { role: string; businessId: string | null },
    @Query('businessId') bizIdParam?: string,
  ) {
    if (user.role === 'ADMIN') return this.svc.resolveAll(bizIdParam ?? undefined);
    if (!user.businessId) throw new ForbiddenException('No business');
    return this.svc.resolveAll(user.businessId);
  }

  /** Call OpenAI to explain a batch of recent error patterns (requires OPENAI_API_KEY). */
  @Post('ai-explain')
  @Roles(Role.ADMIN)
  @UseGuards(AdminTokenGuard)
  aiExplain(@Body(new ZodValidationPipe(z.object({ category: z.string().max(50).optional() }))) body: { category?: string }) {
    return this.svc.aiExplain(body.category);
  }
}
