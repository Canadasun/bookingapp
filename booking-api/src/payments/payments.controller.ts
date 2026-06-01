import {
  Controller, Post, Param, Body, Headers, RawBodyRequest, Req, UseGuards, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const BookingIntentSchema = z.object({
  appointmentId: z.string().min(1),
  businessId: z.string().min(1),
});

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentService: PaymentsService) {}

  // Public — the unauthenticated booking wizard collects the deposit / card-on-file
  // for a just-created PENDING appointment. Scoped to the appointment's business.
  @Post('booking-intent')
  bookingIntent(@Body() body: unknown) {
    const parsed = BookingIntentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('appointmentId and businessId are required');
    return this.paymentService.createBookingIntent(parsed.data.appointmentId, parsed.data.businessId);
  }

  // Owner-initiated deposit (dashboard). Scoped to the owner's business.
  @Post('deposit/:appointmentId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createDeposit(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.paymentService.createDepositIntent(appointmentId, user.businessId);
  }

  @Post('no-show/:appointmentId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  chargeNoShow(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.paymentService.chargeNoShowFee(appointmentId, user.businessId);
  }

  @Post('webhook/stripe')
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    return this.paymentService.handleWebhook(req.rawBody!, sig);
  }
}
