import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { LocationsService } from './locations.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const CreateLocationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(40).optional(),
  timezone: z.string().trim().max(60).optional(),
  defaultLocale: z.enum(['en', 'fr']).nullable().optional(),
  taxProvince: z.string().trim().max(2).nullable().optional(),
  taxRatePercent: z.number().min(0).max(100).nullable().optional(),
  requireDeposit: z.boolean().nullable().optional(),
  depositPercent: z.number().int().min(1).max(100).nullable().optional(),
  cancellationWindowMinutes: z.number().int().nonnegative().max(525_600).nullable().optional(),
  cancellationPolicy: z.string().trim().max(5000).nullable().optional(),
});
const UpdateLocationSchema = CreateLocationSchema.partial().extend({ active: z.boolean().optional() });

type CreateLocation = z.infer<typeof CreateLocationSchema>;
type UpdateLocation = z.infer<typeof UpdateLocationSchema>;

@ApiTags('locations')
@ApiBearerAuth()
@Controller('businesses/:businessId/locations')
export class LocationsController {
  constructor(private locations: LocationsService) {}

  private assertBusiness(user: { role: string; businessId: string | null }, businessId: string) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
  }

  // Readable by any business member (the booking flow + dashboard list need it).
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Param('businessId') businessId: string, @CurrentUser() user: { role: string; businessId: string | null }) {
    this.assertBusiness(user, businessId);
    return this.locations.findAll(businessId, true);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('MANAGE_STAFF')
  create(@Param('businessId') businessId: string, @Body(new ZodValidationPipe(CreateLocationSchema)) dto: CreateLocation, @CurrentUser() user: { role: string; businessId: string | null }) {
    this.assertBusiness(user, businessId);
    return this.locations.create(businessId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('MANAGE_STAFF')
  update(@Param('businessId') businessId: string, @Param('id') id: string, @Body(new ZodValidationPipe(UpdateLocationSchema)) dto: UpdateLocation, @CurrentUser() user: { role: string; businessId: string | null }) {
    this.assertBusiness(user, businessId);
    return this.locations.update(id, businessId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('MANAGE_STAFF')
  remove(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: { role: string; businessId: string | null }) {
    this.assertBusiness(user, businessId);
    return this.locations.remove(id, businessId);
  }
}
