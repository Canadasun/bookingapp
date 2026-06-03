import { Controller, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClientPortalService } from './client-portal.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('client-portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my')
export class ClientPortalController {
  constructor(private svc: ClientPortalService) {}

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
    return this.svc.getAppointments(user.email);
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
}
