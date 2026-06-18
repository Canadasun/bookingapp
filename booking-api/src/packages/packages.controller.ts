import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PackagesService } from './packages.service';
import {
  CreatePackageSchema, CreatePackageDto, UpdatePackageSchema, UpdatePackageDto,
  IssueClientPackageSchema, IssueClientPackageDto, RedeemClientPackageSchema, RedeemClientPackageDto,
} from './dto/packages.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUser = { id: string; role: string; businessId: string | null };
function assertOwns(user: AuthUser, businessId: string) {
  if (user.role !== 'ADMIN' && user.businessId !== businessId) {
    throw new ForbiddenException('You do not have access to this business');
  }
}

@ApiTags('packages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses/:businessId/packages')
export class PackagesController {
  constructor(private svc: PackagesService) {}

  // ── Package products (templates) ─────────────────────────────────────
  @Get()
  list(@Param('businessId') businessId: string, @CurrentUser() user: AuthUser) {
    assertOwns(user, businessId);
    return this.svc.listPackages(businessId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreatePackageSchema)) dto: CreatePackageDto,
    @CurrentUser() user: AuthUser,
  ) {
    assertOwns(user, businessId);
    return this.svc.createPackage(businessId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePackageSchema)) dto: UpdatePackageDto,
    @CurrentUser() user: AuthUser,
  ) {
    assertOwns(user, businessId);
    return this.svc.updatePackage(businessId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  remove(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    assertOwns(user, businessId);
    return this.svc.removePackage(businessId, id);
  }

  // ── Client packages (issued) ─────────────────────────────────────────
  @Get('issued/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  listIssued(
    @Param('businessId') businessId: string,
    @Query('clientId') clientId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    assertOwns(user, businessId);
    return this.svc.listClientPackages(businessId, clientId);
  }

  @Get('issued/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  getIssued(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    assertOwns(user, businessId);
    return this.svc.getClientPackageDetail(businessId, id);
  }

  @Post('issued')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  issue(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(IssueClientPackageSchema)) dto: IssueClientPackageDto,
    @CurrentUser() user: AuthUser,
  ) {
    assertOwns(user, businessId);
    return this.svc.issue(businessId, dto);
  }

  @Post('issued/:id/redeem')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  redeem(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RedeemClientPackageSchema)) dto: RedeemClientPackageDto,
    @CurrentUser() user: AuthUser,
  ) {
    assertOwns(user, businessId);
    return this.svc.redeem(businessId, id, dto);
  }

  @Post('issued/:id/void')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  void(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    assertOwns(user, businessId);
    return this.svc.void(businessId, id);
  }
}
