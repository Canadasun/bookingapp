import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ForbiddenException, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { BusinessesService } from './businesses.service';
import { CreateBusinessSchema, UpdateBusinessSchema, CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, Role } from '@prisma/client';

const HoursSchema = z.object({
  hours: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm'),
  }).refine((value) => value.endTime > value.startTime, {
    path: ['endTime'],
    message: 'endTime must be after startTime',
  })).max(7),
});

const ClosureSchema = z.object({
  startsAt: z.string().datetime({ message: 'startsAt must be a valid ISO 8601 datetime' }),
  endsAt: z.string().datetime({ message: 'endsAt must be a valid ISO 8601 datetime' }),
  reason: z.string().max(500).optional(),
}).refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
  path: ['endsAt'],
  message: 'endsAt must be after startsAt',
});

@ApiTags('business')
@ApiBearerAuth()
@Controller('businesses')
export class BusinessesController {
  constructor(private businessService: BusinessesService, private prisma: PrismaService) {}

  private assertTenantAccess(user: User, id: string) {
    if (user.role !== 'ADMIN' && user.businessId !== id) {
      throw new ForbiddenException('You do not have access to this business');
    }
  }

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

  @Get(':id/dashboard-overview')
  @UseGuards(JwtAuthGuard)
  dashboardOverview(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    this.assertTenantAccess(user, id);
    return this.businessService.dashboardOverview(id, user);
  }

  @Get(':id/reports')
  @UseGuards(JwtAuthGuard)
  reports(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    this.assertTenantAccess(user, id);
    return this.businessService.getReports(id);
  }

  // Full business record (incl. email, plan) — owner dashboard only. The public
  // booking page uses GET /businesses/slug/:slug or /businesses/public/:id.
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    this.assertTenantAccess(user, id);
    return this.businessService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateBusinessSchema)) dto: UpdateBusinessDto,
    @CurrentUser() user: User,
  ) {
    this.assertTenantAccess(user, id);
    // Defense-in-depth: non-admin owners must never set plan even if the DTO
    // schema is changed in future. ADMIN can set it for provisioning.
    const { plan: _plan, ...safeDto } = dto as UpdateBusinessDto & { plan?: unknown };
    const update = user.role === Role.ADMIN ? dto : safeDto;
    const result = await this.businessService.update(id, update as UpdateBusinessDto);
    if (user.role === Role.ADMIN) {
      await this.prisma.auditLog.create({
        data: { entityType: 'BUSINESS', entityId: id, action: 'ADMIN_BUSINESS_UPDATE', userId: user.id, changes: update as object },
      });
    }
    return result;
  }

  @Post(':id/dismiss-onboarding')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  dismissOnboarding(@Param('id') id: string, @CurrentUser() user: User) {
    this.assertTenantAccess(user, id);
    return this.businessService.dismissOnboarding(id);
  }

  // Pause the business (reversible) — hides the public booking page, keeps data.
  @Post(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  deactivate(@Param('id') id: string, @CurrentUser() user: User) {
    this.assertTenantAccess(user, id);
    return this.businessService.deactivate(id);
  }

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  reactivate(@Param('id') id: string, @CurrentUser() user: User) {
    this.assertTenantAccess(user, id);
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
    this.assertTenantAccess(user, id);
    return this.businessService.deleteAccount(id, body?.confirmation ?? '');
  }

  // ── Business hours ──────────────────────────────────────────────────────────

  @Get(':id/hours')
  @UseGuards(JwtAuthGuard)
  getHours(@Param('id') id: string, @CurrentUser() user: User) {
    this.assertTenantAccess(user, id);
    return this.businessService.getHours(id);
  }

  // Upserts all 7 days in one call. Pass enabled days only; omitted days are deleted.
  @Post(':id/hours')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  setHours(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(HoursSchema)) body: z.infer<typeof HoursSchema>,
    @CurrentUser() user: User,
  ) {
    this.assertTenantAccess(user, id);
    return this.businessService.setHours(id, body.hours);
  }

  // ── Business closures ───────────────────────────────────────────────────────

  @Post(':id/closures')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  addClosure(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ClosureSchema)) body: z.infer<typeof ClosureSchema>,
    @CurrentUser() user: User,
  ) {
    this.assertTenantAccess(user, id);
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
    this.assertTenantAccess(user, id);
    return this.businessService.removeClosure(id, closureId);
  }
}
