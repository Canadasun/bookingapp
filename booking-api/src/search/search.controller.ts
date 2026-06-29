import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  // Global search over the owner's business data. Scoped to the caller's own
  // business; staff use the page-only command palette (no data search).
  @Get()
  @Roles(Role.OWNER, Role.ADMIN)
  async global(
    @CurrentUser() user: { role: string; businessId: string | null },
    @Query('q') q?: string,
  ) {
    const term = (q ?? '').trim().slice(0, 100);
    if (!user.businessId || term.length < 2) return { query: term, groups: [] };
    return this.search.global(user.businessId, term);
  }
}
