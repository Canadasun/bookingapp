import { Controller, Get, Post, Param, Body, UseGuards, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { VerificationService } from './verification.service';
import { BusinessesService } from '../businesses/businesses.service';
import { AuthLockService } from '../auth/auth-lock.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard, AdminTokenGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUser = { id: string; role: string; businessId: string | null };

const internalUploadPath = z.string().trim()
  .refine((v) => /^\/(?:proxy\/)?uploads\/[a-zA-Z0-9_-]+$/.test(v), 'Must be an internal /uploads/:id path');

const SubmitSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  address: z.string().trim().min(5).max(500),
  phone: z.string().trim().min(7).max(30),
  governmentIdUrl: internalUploadPath,
  registrationDocUrl: internalUploadPath,
});
const RejectSchema = z.object({ note: z.string().trim().max(500).optional() });

// ── Owner: submit + check their own business verification ───────────────────
@ApiTags('verification')
@ApiBearerAuth()
@Controller('businesses/:businessId/verification')
@UseGuards(JwtAuthGuard)
export class VerificationController {
  constructor(private svc: VerificationService) {}

  private assertOwns(user: AuthUser, businessId: string) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
  }

  @Get()
  status(@Param('businessId') businessId: string, @CurrentUser() user: AuthUser) {
    this.assertOwns(user, businessId);
    return this.svc.status(businessId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  submit(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(SubmitSchema)) dto: z.infer<typeof SubmitSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertOwns(user, businessId);
    return this.svc.submit(businessId, dto);
  }
}

// ── Admin: review the verification queue ────────────────────────────────────
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/verifications')
@UseGuards(JwtAuthGuard, RolesGuard, AdminTokenGuard)
@Roles(Role.ADMIN)
export class AdminVerificationController {
  constructor(private svc: VerificationService) {}

  @Get()
  list() {
    return this.svc.listPending();
  }

  // Businesses auto-flagged at signup as likely duplicates (same name + phone).
  @Get('duplicates')
  duplicates() {
    return this.svc.listFlaggedDuplicates();
  }

  // Dismiss a duplicate flag (keep the business, clear it from the queue).
  @Post(':id/duplicate-reviewed')
  duplicateReviewed(@Param('id') id: string, @CurrentUser() user: User) {
    if (!id) throw new BadRequestException('Business id required');
    return this.svc.resolveDuplicate(id, user.id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.approve(id, user.id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body(new ZodValidationPipe(RejectSchema)) dto: { note?: string }, @CurrentUser() user: User) {
    if (!id) throw new BadRequestException('Business id required');
    return this.svc.reject(id, dto.note, user.id);
  }
}

const EmailBodySchema = z.object({ email: z.string().trim().toLowerCase().email() });

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, AdminTokenGuard)
@Roles(Role.ADMIN)
export class AdminOverviewController {
  constructor(
    private svc: VerificationService,
    private biz: BusinessesService,
    private authLock: AuthLockService,
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Get('overview')
  overview() {
    return this.svc.adminOverview();
  }

  @Get('onboarding/funnel')
  onboardingFunnel() {
    return this.svc.onboardingFunnel();
  }

  @Post('businesses/:id/suspend')
  async suspend(@Param('id') id: string, @CurrentUser() user: User) {
    const result = await this.biz.deactivate(id);
    await this.prisma.auditLog.create({
      data: { entityType: 'BUSINESS', entityId: id, action: 'ADMIN_SUSPENDED', userId: user.id },
    });
    return result;
  }

  @Post('businesses/:id/unsuspend')
  async unsuspend(@Param('id') id: string, @CurrentUser() user: User) {
    const result = await this.biz.reactivate(id);
    await this.prisma.auditLog.create({
      data: { entityType: 'BUSINESS', entityId: id, action: 'ADMIN_REACTIVATED', userId: user.id },
    });
    return result;
  }

  /** Look up a user by email — returns basic profile + lock status. */
  @Post('users/lookup')
  async lookupUser(@Body(new ZodValidationPipe(EmailBodySchema)) body: { email: string }, @CurrentUser() admin: User) {
    const user = await this.prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true, email: true, name: true, role: true,
        createdAt: true, emailVerified: true,
        business: { select: { id: true, name: true, plan: true, suspended: true } },
      },
    });
    if (!user) throw new NotFoundException('No account found with that email address');
    const lockStatus = await this.authLock.lockStatus(body.email).catch(() => ({ locked: false, failCount: 0, lockTtlSeconds: 0 }));
    await this.prisma.auditLog.create({
      data: { entityType: 'USER', entityId: user.id, action: 'ADMIN_LOOKUP', userId: admin.id },
    });
    return { ...user, lockStatus };
  }

  /** Immediately clear a brute-force lock on an account. */
  @Post('users/unlock')
  async unlockUser(@Body(new ZodValidationPipe(EmailBodySchema)) body: { email: string }, @CurrentUser() admin: User) {
    const user = await this.prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (!user) throw new NotFoundException('No account found with that email address');
    await this.authLock.unlockAccount(body.email);
    await this.prisma.auditLog.create({
      data: { entityType: 'USER', entityId: user.id, action: 'ADMIN_UNLOCK', userId: admin.id },
    });
    return { ok: true, message: `Account unlocked for ${body.email}` };
  }

  /** Send a password-reset email on behalf of support. */
  @Post('users/send-reset')
  async sendReset(@Body(new ZodValidationPipe(EmailBodySchema)) body: { email: string }, @CurrentUser() admin: User) {
    const target = await this.prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
    await this.authService.forgotPassword(body.email);
    if (target) {
      await this.prisma.auditLog.create({
        data: { entityType: 'USER', entityId: target.id, action: 'ADMIN_SEND_RESET', userId: admin.id },
      });
    }
    return { ok: true, message: `Password reset email sent to ${body.email}` };
  }
}
