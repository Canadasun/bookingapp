import { Controller, Get, Post, Patch, Param, Body, Query, Headers, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BookingsService } from './bookings.service';
import { verifyAppointmentToken } from '../common/util/appointment-token';
import {
  CreateAppointmentSchema, CreateAppointmentDto, PublicCreateAppointmentSchema, PublicCreateAppointmentDto,
  CreateRecurringSchema, CreateRecurringDto,
  RescheduleSchema, RescheduleDto,
  StatusSchema, StatusDto,
  PublicStatusSchema, PublicStatusDto,
  LateCancelRequestSchema, LateCancelRequestDto,
  UpdateAppointmentSchema, UpdateAppointmentDto,
} from './dto/appointment.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { z } from 'zod';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

function pagination(page?: string, limit?: string) {
  const result = PaginationSchema.safeParse({ page, limit });
  if (!result.success) throw new BadRequestException('Please provide a valid page number and a limit between 1 and 200.');
  return result.data;
}

@ApiTags('bookings')
@Controller('bookings')
export class PublicBookingsController {
  constructor(private bookingsService: BookingsService) {}

  // Every public-by-id route requires the HMAC manage token from the emailed
  // link, so knowing an appointment id alone isn't enough to read or change it.
  private assertToken(id: string, token?: string) {
    if (!verifyAppointmentToken(id, token)) {
      throw new ForbiddenException('Invalid or missing manage token');
    }
  }

  // Token is accepted only from x-manage-token so it cannot leak through URLs.
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Headers('x-manage-token') headerToken?: string,
  ) {
    const token = headerToken;
    this.assertToken(id, token);
    return this.bookingsService.findOnePublic(id, token!);
  }

  // Public cancel — used by the client manage page (no login required).
  // PublicStatusSchema enforces status === 'CANCELLED', so this endpoint can't be
  // used to confirm/complete/no-show a booking even with a valid token.
  // Token in body (not URL) so it stays out of access logs.
  @Patch(':id/status')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PublicStatusSchema)) dto: PublicStatusDto,
    @Headers('x-manage-token') headerToken?: string,
  ) {
    const token = dto.token ?? headerToken;
    this.assertToken(id, token);
    const appointment = await this.bookingsService.updateStatus(id, dto);
    return this.bookingsService.toPublicAppointment(appointment, token!);
  }

  // Public late-cancel request — does NOT cancel the appointment. It only alerts
  // the owner when the client is inside the cancellation window.
  @Post(':id/late-cancel-request')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  requestLateCancel(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(LateCancelRequestSchema)) dto: LateCancelRequestDto,
    @Headers('x-manage-token') headerToken?: string,
  ) {
    const token = dto.token ?? headerToken;
    this.assertToken(id, token);
    return this.bookingsService.requestLateCancellation(id, dto.cancelReason);
  }

  // Public reschedule — used by the client manage page redirect to booking wizard.
  @Patch(':id/reschedule')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async reschedule(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RescheduleSchema)) dto: RescheduleDto,
    @Headers('x-manage-token') headerToken?: string,
  ) {
    const token = dto.token ?? headerToken;
    this.assertToken(id, token);
    const appointment = await this.bookingsService.reschedule(id, dto, undefined, { byClient: true });
    return this.bookingsService.toPublicAppointment(appointment, token!);
  }
}

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('businesses/:businessId/bookings')
export class BookingsController {

  constructor(private appointmentService: BookingsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  findAll(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('Access denied to this business resource');
    }
    const paging = pagination(page, limit);
    return this.appointmentService.findAll(businessId, paging.page, paging.limit, user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  findOne(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
  ) {
    return this.appointmentService.findOne(id, businessId);
  }

  // Public — called from the unauthenticated booking wizard. Goes PENDING and
  // waits for owner approval.
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(PublicCreateAppointmentSchema)) dto: PublicCreateAppointmentDto,
  ) {
    return this.appointmentService.createPublic(businessId, dto);
  }

  // Owner/staff-initiated booking (dashboard / mobile app). Authenticated and
  // ownership-checked, so it skips approval: created CONFIRMED, and the client
  // gets a confirmation immediately.
  @Post('manual')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  createManual(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateAppointmentSchema)) dto: CreateAppointmentDto,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    const canOverride = dto.allowOverride === true && (user.role === 'OWNER' || user.role === 'ADMIN');
    return this.appointmentService.create(businessId, dto, { confirmed: true, overrideConflicts: canOverride });
  }

  // Owner/staff-initiated recurring series (dashboard). Creates N confirmed
  // occurrences; conflicting ones are skipped and reported.
  @Post('recurring')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  createRecurring(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateRecurringSchema)) dto: CreateRecurringDto,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    const canOverride = dto.allowOverride === true && (user.role === 'OWNER' || user.role === 'ADMIN');
    return this.appointmentService.createRecurring(businessId, { ...dto, allowOverride: canOverride }, { confirmed: true });
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard, TenantGuard)
  confirm(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    return this.appointmentService.confirm(id, businessId, user.id);
  }

  @Patch(':id/reschedule')
  @UseGuards(JwtAuthGuard, TenantGuard)
  reschedule(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(RescheduleSchema)) dto: RescheduleDto,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    return this.appointmentService.reschedule(id, dto, businessId, { userId: user.id });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  updateDetails(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(UpdateAppointmentSchema)) dto: UpdateAppointmentDto,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    return this.appointmentService.updateDetails(id, dto, businessId, user.id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, TenantGuard)
  updateStatus(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(StatusSchema)) dto: StatusDto,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    return this.appointmentService.updateStatus(id, dto, businessId, true, user.id);
  }
}
