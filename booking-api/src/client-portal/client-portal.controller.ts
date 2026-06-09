import { Controller, Get, Post, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClientPortalService } from './client-portal.service';
import { PaymentsService } from '../payments/payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('client-portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my')
export class ClientPortalController {
  constructor(private svc: ClientPortalService, private payments: PaymentsService) {}

  // The portal matches Client records by the user's email, so the email MUST be
  // verified first — otherwise registering an unowned address would expose that
  // address's bookings/messages. 403 with a stable code the web can act on.
  private assertVerified(user: User) {
    if (!user.emailVerified) {
      throw new ForbiddenException('EMAIL_NOT_VERIFIED');
    }
  }

  @Get('appointments')
  appointments(@CurrentUser() user: User) {
    this.assertVerified(user);
    return this.svc.getAppointments(user.email, user.name);
  }

  @Get('messages')
  messages(@CurrentUser() user: User) {
    this.assertVerified(user);
    return this.svc.getMessages(user.email);
  }

  @Get('offers')
  offers(@CurrentUser() user: User) {
    this.assertVerified(user);
    return this.svc.getOffers(user.email);
  }

  // Whether the client has a card saved with any business (for no-show / deposit
  // protection), so the portal can offer to remove it.
  @Get('payment-method')
  cardStatus(@CurrentUser() user: User) {
    this.assertVerified(user);
    return this.payments.clientCardStatus(user.email);
  }

  // Client delinks their saved card(s): detached from Stripe and cleared from
  // their appointments, so no automatic or manual charges can use it anymore.
  @Post('payment-method/remove')
  removeCard(@CurrentUser() user: User) {
    this.assertVerified(user);
    return this.payments.removeClientCards(user.email);
  }
}
