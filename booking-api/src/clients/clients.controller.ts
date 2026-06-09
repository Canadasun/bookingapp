import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, ForbiddenException, Res, HttpCode } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientSchema, UpdateClientSchema, CreateClientDto, UpdateClientDto, MergeClientsSchema, MergeClientsDto } from './dto/client.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('businesses/:businessId/clients')
export class ClientsController {
  constructor(private clientService: ClientsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.clientService.findAll(
      businessId, search,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 25,
    );
  }

  // (Removed) The unauthenticated guest "lookup by email/phone" endpoint was
  // dropped: it disclosed a person's name, phone and booking history to anyone
  // who knew their email/phone. Clients now manage bookings only via the signed
  // link in their confirmation email, or by signing into the portal.

  // CSV export — before :id so the literal path isn't consumed as a param
  @Get('export-csv')
  @UseGuards(JwtAuthGuard)
  async exportCsv(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
    @Res() res: Response,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) throw new ForbiddenException();
    const clients = await this.clientService.exportAll(businessId);
    const header = 'Name,Email,Phone,Tags,Notes,Birthday,Created\n';
    const rows = clients.map(c =>
      [c.name, c.email ?? '', c.phone ?? '', c.tags.join(';'), (c.notes ?? '').replace(/,/g, ' '), c.birthday ?? '', c.createdAt.toISOString()].map(v => `"${v}"`).join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="clients.csv"');
    res.send(header + rows);
  }

  // CSV import — bulk upsert clients from uploaded CSV
  @Post('import-csv')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  importCsv(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
    @Body() body: { rows: Array<{ name: string; email?: string; phone?: string; tags?: string; notes?: string }> },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) throw new ForbiddenException();
    return this.clientService.bulkImport(businessId, body.rows);
  }

  // Declared before @Get(':id') so "duplicates" isn't swallowed as a client id.
  @Get('duplicates')
  @UseGuards(JwtAuthGuard)
  duplicates(@Param('businessId') businessId: string, @CurrentUser() user: { role: string; businessId: string | null }) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.clientService.findDuplicates(businessId);
  }

  @Post('merge')
  @UseGuards(JwtAuthGuard)
  merge(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(MergeClientsSchema)) dto: MergeClientsDto,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.clientService.merge(businessId, dto.primaryId, dto.dupeIds, {
      name: dto.name, email: dto.email, phone: dto.phone,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.clientService.findOne(id, businessId);
  }

  @Get(':id/bookings')
  @UseGuards(JwtAuthGuard)
  getHistory(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.clientService.getAppointmentHistory(id, businessId);
  }

  // Public — called during the unauthenticated booking wizard
  @Post()
  create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateClientSchema)) dto: CreateClientDto,
  ) {
    return this.clientService.findOrCreate(businessId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(UpdateClientSchema)) dto: UpdateClientDto,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.clientService.update(id, dto, businessId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.clientService.remove(id, businessId);
  }
}
