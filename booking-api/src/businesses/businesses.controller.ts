import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';
import { CreateBusinessSchema, UpdateBusinessSchema, CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, Role } from '@prisma/client';

@ApiTags('business')
@ApiBearerAuth()
@Controller('businesses')
export class BusinessesController {
  constructor(private businessService: BusinessesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  create(
    @Body(new ZodValidationPipe(CreateBusinessSchema)) dto: CreateBusinessDto,
    @CurrentUser() user: User,
  ) {
    return this.businessService.create(dto, user.id);
  }

  // Public endpoint for sitemap generation — returns slugs of all active businesses.
  // No auth required; rate-limited to prevent enumeration abuse.
  @Get('public-slugs')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  publicSlugs() {
    return this.businessService.getPublicSlugs();
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.businessService.findBySlugPublic(slug);
  }

  @Get('public/:id')
  findPublicById(@Param('id') id: string) {
    return this.businessService.findPublicById(id);
  }

  // Full business record (incl. email, plan) — owner dashboard only. The public
  // booking page uses GET /businesses/slug/:slug or /businesses/public/:id.
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== id) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.businessService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateBusinessSchema)) dto: UpdateBusinessDto,
    @CurrentUser() user: User,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== id) {
      throw new ForbiddenException('You do not have access to this business');
    }
    // Defense-in-depth: non-admin owners must never set plan even if the DTO
    // schema is changed in future. ADMIN can set it for provisioning.
    const { plan: _plan, ...safeDto } = dto as UpdateBusinessDto & { plan?: unknown };
    const update = user.role === Role.ADMIN ? dto : safeDto;
    return this.businessService.update(id, update as UpdateBusinessDto);
  }

  // Pause the business (reversible) — hides the public booking page, keeps data.
  @Post(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  deactivate(@Param('id') id: string, @CurrentUser() user: User) {
    if (user.role !== 'ADMIN' && user.businessId !== id) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.businessService.deactivate(id);
  }

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  reactivate(@Param('id') id: string, @CurrentUser() user: User) {
    if (user.role !== 'ADMIN' && user.businessId !== id) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.businessService.reactivate(id);
  }

  // Permanently delete the business and ALL its data. Irreversible. Requires the
  // owner to type the business name back as `confirmation`.
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  remove(
    @Param('id') id: string,
    @Body() body: { confirmation?: string },
    @CurrentUser() user: User,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== id) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.businessService.deleteAccount(id, body?.confirmation ?? '');
  }

  // ── Business hours ──────────────────────────────────────────────────────────

  @Get(':id/hours')
  @UseGuards(JwtAuthGuard)
  getHours(@Param('id') id: string, @CurrentUser() user: User) {
    if (user.role !== 'ADMIN' && user.businessId !== id) throw new ForbiddenException();
    return this.businessService.getHours(id);
  }

  // Upserts all 7 days in one call. Pass enabled days only; omitted days are deleted.
  @Post(':id/hours')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  setHours(
    @Param('id') id: string,
    @Body() body: { hours: { dayOfWeek: number; startTime: string; endTime: string }[] },
    @CurrentUser() user: User,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== id) throw new ForbiddenException();
    return this.businessService.setHours(id, body.hours ?? []);
  }

  // ── Business closures ───────────────────────────────────────────────────────

  @Post(':id/closures')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  addClosure(
    @Param('id') id: string,
    @Body() body: { startsAt: string; endsAt: string; reason?: string },
    @CurrentUser() user: User,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== id) throw new ForbiddenException();
    if (!body.startsAt || !body.endsAt) throw new BadRequestException('startsAt and endsAt are required');
    return this.businessService.addClosure(id, body);
  }

  @Delete(':id/closures/:closureId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  removeClosure(
    @Param('id') id: string,
    @Param('closureId') closureId: string,
    @CurrentUser() user: User,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== id) throw new ForbiddenException();
    return this.businessService.removeClosure(id, closureId);
  }
}
