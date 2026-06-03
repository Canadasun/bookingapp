import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BookingsService } from './bookings.service';
import { verifyAppointmentToken } from '../common/util/appointment-token';
import {
  CreateAppointmentSchema, CreateAppointmentDto,
  RescheduleSchema, RescheduleDto,
  StatusSchema, StatusDto,
  PublicStatusSchema, PublicStatusDto,
} from './dto/appointment.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

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

  @Get(':id')
  findOne(@Param('id') id: string, @Query('token') token?: string) {
    this.assertToken(id, token);
    return this.bookingsService.findOne(id);
  }

  // Public cancel — used by the client manage page (no login required).
  // PublicStatusSchema enforces status === 'CANCELLED', so this endpoint can't be
  // used to confirm/complete/no-show a booking even with a valid token.
  @Patch(':id/status')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PublicStatusSchema)) dto: PublicStatusDto,
    @Query('token') token?: string,
  ) {
    this.assertToken(id, token);
    return this.bookingsService.updateStatus(id, dto);
  }

  // Public reschedule — used by the client manage page redirect to booking wizard.
  @Patch(':id/reschedule')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  reschedule(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RescheduleSchema)) dto: RescheduleDto,
    @Query('token') token?: string,
  ) {
    this.assertToken(id, token);
    return this.bookingsService.reschedule(id, dto, undefined, { byClient: true });
  }
}

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('businesses/:businessId/bookings')
export class BookingsController {

  constructor(private appointmentService: BookingsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.appointmentService.findAll(
      businessId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      user,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.appointmentService.findOne(id, businessId);
  }

  // Public — called from the unauthenticated booking wizard. Goes PENDING and
  // waits for owner approval.
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateAppointmentSchema)) dto: CreateAppointmentDto,
  ) {
    return this.appointmentService.create(businessId, dto);
  }

  // Owner/staff-initiated booking (dashboard / mobile app). Authenticated and
  // ownership-checked, so it skips approval: created CONFIRMED, and the client
  // gets a confirmation immediately.
  @Post('manual')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  createManual(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateAppointmentSchema)) dto: CreateAppointmentDto,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.appointmentService.create(businessId, dto, { confirmed: true });
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard)
  confirm(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.appointmentService.confirm(id, businessId, user.id);
  }

  @Patch(':id/reschedule')
  @UseGuards(JwtAuthGuard)
  reschedule(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(RescheduleSchema)) dto: RescheduleDto,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.appointmentService.reschedule(id, dto, businessId, { userId: user.id });
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(StatusSchema)) dto: StatusDto,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.appointmentService.updateStatus(id, dto, businessId, true, user.id);
  }
}
