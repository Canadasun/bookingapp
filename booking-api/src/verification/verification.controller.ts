import { Controller, Get, Post, Param, Body, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { VerificationService } from './verification.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUser = { id: string; role: string; businessId: string | null };

const SubmitSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  address: z.string().trim().min(5).max(500),
  phone: z.string().trim().min(7).max(30),
  governmentIdUrl: z.string().trim().min(1).max(2048),
  registrationDocUrl: z.string().trim().min(1).max(2048),
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
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminVerificationController {
  constructor(private svc: VerificationService) {}

  @Get()
  list() {
    return this.svc.listPending();
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.svc.approve(id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body(new ZodValidationPipe(RejectSchema)) dto: { note?: string }) {
    if (!id) throw new BadRequestException('Business id required');
    return this.svc.reject(id, dto.note);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminOverviewController {
  constructor(private svc: VerificationService) {}

  @Get('overview')
  overview() {
    return this.svc.adminOverview();
  }
}
