import { Controller, Get, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RedisService } from '../common/redis/redis.service';
import { EventsGateway } from './events.gateway';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly gateway: EventsGateway,
  ) {}

  // Mint a short-lived ticket the browser passes in the WebSocket handshake.
  // The access token lives in an HttpOnly cookie (unreadable by JS), so the
  // socket — which connects cross-origin — can't send it directly; this ticket,
  // issued over the authenticated same-origin proxy, carries just enough to
  // authorize the connection and scope it to the caller's business.
  // A UUID jti is stored in Redis with a matching TTL so it can only be
  // consumed once (single-use enforcement happens in handleJoinBusiness).
  @Get('ws-ticket')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async ticket(@CurrentUser() user: User) {
    const jti = randomUUID();
    await this.redis.client.set(`ws:ticket:${jti}`, '1', 'EX', 120);
    const ticket = this.jwt.sign(
      { sub: user.id, role: user.role, businessId: user.businessId, kind: 'ws', jti },
      { secret: process.env.JWT_SECRET, expiresIn: '2m' },
    );
    return { ticket };
  }

  // Returns the set of user IDs currently connected and joined to this business
  // room. Useful for rendering staff online/offline indicators on the dashboard.
  @Get('online-staff/:businessId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async onlineStaff(
    @Param('businessId') businessId: string,
    @CurrentUser() user: User,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('Access denied');
    }
    const onlineUserIds = await this.gateway.getOnlineStaff(businessId);
    return { onlineUserIds };
  }
}
