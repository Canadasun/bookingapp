import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MigrationsService } from './migrations.service';
import {
  ConfirmMigrationImportSchema,
  CreateMigrationRequestDto,
  CreateMigrationRequestSchema,
  StageMigrationRowsDto,
  StageMigrationRowsSchema,
} from './dto/migration.dto';

@ApiTags('migrations')
@ApiBearerAuth()
@Controller('businesses/:businessId/migrations')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN)
export class MigrationsController {
  constructor(private migrations: MigrationsService) {}

  @Get()
  list(@Param('businessId') businessId: string) {
    return this.migrations.listRequests(businessId);
  }

  @Post()
  create(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(CreateMigrationRequestSchema)) dto: CreateMigrationRequestDto,
  ) {
    return this.migrations.createRequest(businessId, dto, user.id);
  }

  @Get(':id')
  get(@Param('businessId') businessId: string, @Param('id') id: string) {
    return this.migrations.getRequest(businessId, id);
  }

  @Post(':id/stage')
  stageRows(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(StageMigrationRowsSchema)) dto: StageMigrationRowsDto,
  ) {
    return this.migrations.stageRows(businessId, id, dto, user.id);
  }

  @Post('batches/:batchId/import')
  confirmImport(
    @Param('businessId') businessId: string,
    @Param('batchId') batchId: string,
    @Body(new ZodValidationPipe(ConfirmMigrationImportSchema)) _dto: unknown,
  ) {
    return this.migrations.confirmImport(businessId, batchId);
  }
}
