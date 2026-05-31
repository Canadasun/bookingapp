import { Controller, Get, UseGuards } from '@nestjs/common';
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

  @Get('appointments')
  appointments(@CurrentUser() user: User) {
    return this.svc.getAppointments(user.email);
  }

  @Get('messages')
  messages(@CurrentUser() user: User) {
    return this.svc.getMessages(user.email);
  }

  @Get('offers')
  offers(@CurrentUser() user: User) {
    return this.svc.getOffers(user.email);
  }
}
