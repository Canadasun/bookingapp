import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MigrationLeadsService } from './migration-leads.service';
import {
  CreateMigrationLeadSchema,
  CreateMigrationLeadDto,
  UpdateMigrationLeadStatusSchema,
  UpdateMigrationLeadStatusDto,
} from './dto/migration-lead.dto';

// Public — the marketing-site concierge migration form (prospects, no account).
// No auth guard (globally throttled); persists the lead + alerts an admin.
@ApiTags('migration-leads')
@Controller('public/migration-leads')
export class PublicMigrationLeadsController {
  constructor(private service: MigrationLeadsService) {}

  @Post()
  create(@Body(new ZodValidationPipe(CreateMigrationLeadSchema)) dto: CreateMigrationLeadDto) {
    return this.service.create(dto);
  }
}

// Admin — review and triage captured migration leads.
@ApiTags('migration-leads')
@Controller('admin/migration-leads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminMigrationLeadsController {
  constructor(private service: MigrationLeadsService) {}

  @Get()
  list() {
    return this.service.listForAdmin();
  }

  @Patch(':id')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateMigrationLeadStatusSchema)) dto: UpdateMigrationLeadStatusDto,
  ) {
    return this.service.updateStatus(id, dto.status);
  }
}
