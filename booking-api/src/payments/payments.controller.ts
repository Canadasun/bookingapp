import {
  Controller, Post, Param, Headers, RawBodyRequest, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentService: PaymentsService) {}

  @Post('deposit/:appointmentId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createDeposit(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    return this.paymentService.createDepositIntent(appointmentId, user);
  }

  @Post('no-show/:appointmentId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  chargeNoShow(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    return this.paymentService.chargeNoShowFee(appointmentId, user);
  }

  @Post('webhook/stripe')
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    return this.paymentService.handleWebhook(req.rawBody!, sig);
  }
}
