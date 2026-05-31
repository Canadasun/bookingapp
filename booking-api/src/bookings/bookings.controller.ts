import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import {
  CreateAppointmentSchema, CreateAppointmentDto,
  RescheduleSchema, RescheduleDto,
  StatusSchema, StatusDto,
} from './dto/appointment.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('bookings')
@Controller('bookings')
export class PublicBookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  // Public cancel/status — used by the client manage page (no login required).
  // Only allows CANCELLED status to prevent abuse.
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(StatusSchema)) dto: StatusDto,
  ) {
    return this.bookingsService.updateStatus(id, dto);
  }

  // Public reschedule — used by the client manage page redirect to booking wizard.
  // The actual reschedule is handled in the booking wizard as a new slot pick + PATCH.
  @Patch(':id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RescheduleSchema)) dto: RescheduleDto,
  ) {
    return this.bookingsService.reschedule(id, dto);
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

  // Public — called from the unauthenticated booking wizard
  @Post()
  create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateAppointmentSchema)) dto: CreateAppointmentDto,
  ) {
    return this.appointmentService.create(businessId, dto);
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
    return this.appointmentService.confirm(id, businessId);
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
    return this.appointmentService.reschedule(id, dto, businessId);
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
    return this.appointmentService.updateStatus(id, dto, businessId, true);
  }
}
