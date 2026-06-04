import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly jwt: JwtService) {}

  // Mint a short-lived ticket the browser passes in the WebSocket handshake.
  // The access token lives in an HttpOnly cookie (unreadable by JS), so the
  // socket — which connects cross-origin — can't send it directly; this ticket,
  // issued over the authenticated same-origin proxy, carries just enough to
  // authorize the connection and scope it to the caller's business.
  @Get('ws-ticket')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  ticket(@CurrentUser() user: User) {
    const ticket = this.jwt.sign(
      { sub: user.id, role: user.role, businessId: user.businessId, kind: 'ws' },
      { secret: process.env.JWT_SECRET, expiresIn: '2m' },
    );
    return { ticket };
  }
}
