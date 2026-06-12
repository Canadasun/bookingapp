import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import {
  CreateInvoiceSchema, CreateInvoiceDto,
  UpdateInvoiceSchema, UpdateInvoiceDto,
  UpdateInvoiceStatusSchema, UpdateInvoiceStatusDto,
} from './dto/invoice.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('businesses/:businessId/invoices')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@RequirePermissions('VIEW_MONEY')
export class InvoicesController {
  constructor(private invoices: InvoicesService) {}

  @Get()
  list(@Param('businessId') businessId: string) {
    return this.invoices.list(businessId);
  }

  @Get(':id')
  get(@Param('businessId') businessId: string, @Param('id') id: string) {
    return this.invoices.get(id, businessId);
  }

  @Post()
  create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateInvoiceSchema)) dto: CreateInvoiceDto,
  ) {
    return this.invoices.create(businessId, dto);
  }

  @Patch(':id')
  update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateInvoiceSchema)) dto: UpdateInvoiceDto,
  ) {
    return this.invoices.update(id, businessId, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateInvoiceStatusSchema)) dto: UpdateInvoiceStatusDto,
  ) {
    return this.invoices.updateStatus(id, businessId, dto);
  }

  @Post(':id/send')
  sendByEmail(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    return this.invoices.sendByEmail(id, businessId);
  }

  @Delete(':id')
  remove(@Param('businessId') businessId: string, @Param('id') id: string) {
    return this.invoices.remove(id, businessId);
  }
}
