import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Res, HttpCode, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { ClientsService } from './clients.service';
import { CreateClientSchema, UpdateClientSchema, CreateClientDto, UpdateClientDto, MergeClientsSchema, MergeClientsDto } from './dto/client.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

const MAX_IMPORT_ROWS = 1000;
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(25),
});

function pagination(page?: string, limit?: string) {
  const result = PaginationSchema.safeParse({ page, limit });
  if (!result.success) throw new BadRequestException('Invalid pagination parameters');
  return result.data;
}

function csvCell(value: unknown) {
  let text = String(value ?? '').replace(/"/g, '""');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text}"`;
}
const ImportCsvRowSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().optional().or(z.literal('')).transform(v => v || undefined),
  phone: z.string().trim().max(30).optional(),
  tags: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

@ApiTags('clients')
@ApiBearerAuth()
@Controller('businesses/:businessId/clients')
export class ClientsController {
  constructor(private clientService: ClientsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  findAll(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('Access denied to this business resource');
    }
    const paging = pagination(page, limit);
    return this.clientService.findAll(businessId, search?.slice(0, 100), paging.page, paging.limit);
  }

  // (Removed) The unauthenticated guest "lookup by email/phone" endpoint was
  // dropped: it disclosed a person's name, phone and booking history to anyone
  // who knew their email/phone. Clients now manage bookings only via the signed
  // link in their confirmation email, or by signing into the portal.

  // CSV export — before :id so the literal path isn't consumed as a param
  @Get('export-csv')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  async exportCsv(
    @Param('businessId') businessId: string,
    @Res() res: Response,
  ) {
    const clients = await this.clientService.exportAll(businessId);
    const header = 'Name,Email,Phone,Tags,Notes,Birthday,Created\n';
    const rows = clients.map(c =>
      [c.name, c.email, c.phone, c.tags.join(';'), c.notes, c.birthday, c.createdAt.toISOString()].map(csvCell).join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="clients.csv"');
    res.send(header + rows);
  }

  // CSV import — bulk upsert clients from uploaded CSV
  @Post('import-csv')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  importCsv(
    @Param('businessId') businessId: string,
    @Body() body: { rows: unknown[] },
  ) {
    if (!Array.isArray(body?.rows)) throw new BadRequestException('rows must be an array');
    if (body.rows.length > MAX_IMPORT_ROWS) throw new BadRequestException(`Cannot import more than ${MAX_IMPORT_ROWS} rows at once`);
    const parsed = body.rows.map((row, i) => {
      const result = ImportCsvRowSchema.safeParse(row);
      if (!result.success) throw new BadRequestException(`Row ${i + 1}: ${result.error.errors[0]?.message ?? 'invalid'}`);
      return result.data;
    });
    return this.clientService.bulkImport(businessId, parsed);
  }

  // Declared before @Get(':id') so "duplicates" isn't swallowed as a client id.
  @Get('duplicates')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  duplicates(@Param('businessId') businessId: string) {
    return this.clientService.findDuplicates(businessId);
  }

  @Post('merge')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  merge(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(MergeClientsSchema)) dto: MergeClientsDto,
  ) {
    return this.clientService.merge(businessId, dto.primaryId, dto.dupeIds, {
      name: dto.name, email: dto.email, phone: dto.phone,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  findOne(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
  ) {
    return this.clientService.findOne(id, businessId);
  }

  @Get(':id/bookings')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getHistory(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
  ) {
    return this.clientService.getAppointmentHistory(id, businessId);
  }

  // Public — called during the unauthenticated booking wizard
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateClientSchema)) dto: CreateClientDto,
    @CurrentUser() user?: { role: string; businessId: string | null },
  ) {
    if (user && (user.role === 'ADMIN' || user.businessId === businessId) && user.role !== 'CLIENT') {
      return this.clientService.findOrCreate(businessId, dto);
    }
    return this.clientService.createPublicBookingClient(businessId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  update(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(UpdateClientSchema)) dto: UpdateClientDto,
  ) {
    return this.clientService.update(id, dto, businessId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  remove(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
  ) {
    return this.clientService.remove(id, businessId);
  }
}
