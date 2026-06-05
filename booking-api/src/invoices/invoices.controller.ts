import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceSchema, CreateInvoiceDto, UpdateInvoiceStatusSchema, UpdateInvoiceStatusDto } from './dto/invoice.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('businesses/:businessId/invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('VIEW_MONEY')
export class InvoicesController {
  constructor(private invoices: InvoicesService) {}

  private assertBusiness(user: { role: string; businessId: string | null }, businessId: string) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
  }

  @Get()
  list(@Param('businessId') businessId: string, @CurrentUser() user: { role: string; businessId: string | null }) {
    this.assertBusiness(user, businessId);
    return this.invoices.list(businessId);
  }

  @Get(':id')
  get(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: { role: string; businessId: string | null }) {
    this.assertBusiness(user, businessId);
    return this.invoices.get(id, businessId);
  }

  @Post()
  create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateInvoiceSchema)) dto: CreateInvoiceDto,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    this.assertBusiness(user, businessId);
    return this.invoices.create(businessId, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateInvoiceStatusSchema)) dto: UpdateInvoiceStatusDto,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    this.assertBusiness(user, businessId);
    return this.invoices.updateStatus(id, businessId, dto);
  }

  @Delete(':id')
  remove(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: { role: string; businessId: string | null }) {
    this.assertBusiness(user, businessId);
    return this.invoices.remove(id, businessId);
  }
}
