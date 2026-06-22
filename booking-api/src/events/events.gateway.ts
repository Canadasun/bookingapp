import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisService } from '../common/redis/redis.service';

// Reflect the same origin allowlist as the REST CORS in main.ts. Falls back to
// reflecting any origin only outside production (local dev / tooling).
function corsOrigin(): string[] | boolean {
  const list = (process.env.CORS_ALLOWED_ORIGINS ?? process.env.NEXT_PUBLIC_WEB_URL ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (list.length) return list;
  return process.env.NODE_ENV !== 'production';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SocketUser = { id: string; role: string; businessId: string | null };

export interface BookingUpdatePayload {
  type: 'CREATE' | 'UPDATE' | 'UPDATE_STATUS' | 'UPDATE_DETAILS' | 'CANCEL' | 'RESCHEDULE' | 'NO_SHOW';
  appointmentId: string;
  status: string;
}

export interface StaffPresencePayload {
  userId: string;
  online: boolean;
}

@WebSocketGateway({ cors: { origin: corsOrigin(), credentials: true } })
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('EventsGateway');

  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

  afterInit(server: Server) {
    const pub = this.redis.client.duplicate();
    const sub = this.redis.client.duplicate();
    server.adapter(createAdapter(pub, sub));
    this.logger.log('Socket.IO Redis adapter initialized');
  }

  // Authenticate at connection time using a short-lived WS ticket the client
  // fetches from GET /events/ws-ticket (authenticated via the same session). An
  // unauthenticated or invalid socket is dropped immediately — no anonymous
  // sockets, so no one can subscribe to a business they don't belong to.
  // JTI single-use enforcement happens at joinBusiness time so Redis is not
  // on the synchronous connection hot-path.
  handleConnection(client: Socket) {
    const ticket =
      (client.handshake.auth?.ticket as string | undefined) ||
      (client.handshake.auth?.token as string | undefined);
    try {
      const p = this.jwt.verify(ticket ?? '', { secret: process.env.JWT_SECRET, algorithms: ['HS256'] }) as {
        sub?: string; role?: string; businessId?: string | null; kind?: string; jti?: string;
      };
      if (p.kind !== 'ws' || !p.sub || !p.jti) throw new Error('not a ws ticket');
      client.data.user = { id: p.sub, role: p.role ?? 'CLIENT', businessId: p.businessId ?? null } as SocketUser;
      client.data.jti = p.jti;
      this.logger.log(`Client connected: ${client.id} (user ${p.sub})`);
    } catch {
      this.logger.warn(`Rejected unauthenticated socket ${client.id}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const user = client.data.user as SocketUser | undefined;
    const joinedBusiness = client.data.joinedBusiness as string | undefined;
    if (user && joinedBusiness) {
      try {
        await this.redis.client.srem(`staff:online:${joinedBusiness}`, user.id);
        this.server.to(`business_${joinedBusiness}`).emit('staffPresence', {
          userId: user.id, online: false,
        } satisfies StaffPresencePayload);
      } catch { /* best effort — never block disconnect */ }
    }
  }

  @SubscribeMessage('joinBusiness')
  async handleJoinBusiness(@ConnectedSocket() client: Socket, @MessageBody() businessId: string) {
    const user = client.data.user as SocketUser | undefined;
    const jti = client.data.jti as string | undefined;

    if (!user || !jti) return;

    if (!UUID_RE.test(businessId)) {
      this.logger.warn(`Client ${client.id} sent invalid businessId: ${businessId}`);
      client.disconnect(true);
      return;
    }

    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      this.logger.warn(`Client ${client.id} denied join for business ${businessId}`);
      return;
    }

    // Single-use ticket: atomically consume the JTI from Redis so the same
    // ticket cannot be reused to join a different business room or replay.
    const valid = await this.redis.client.getdel(`ws:ticket:${jti}`);
    if (!valid) {
      this.logger.warn(`Ticket JTI already consumed for socket ${client.id}`);
      client.disconnect(true);
      return;
    }
    client.data.jti = null;

    client.data.joinedBusiness = businessId;
    client.join(`business_${businessId}`);
    this.logger.log(`Client ${client.id} joined business room: ${businessId}`);

    try {
      await this.redis.client.sadd(`staff:online:${businessId}`, user.id);
      await this.redis.client.expire(`staff:online:${businessId}`, 86400);
      this.server.to(`business_${businessId}`).emit('staffPresence', {
        userId: user.id, online: true,
      } satisfies StaffPresencePayload);
    } catch { /* best effort */ }
  }

  @SubscribeMessage('leaveBusiness')
  handleLeaveBusiness(@ConnectedSocket() client: Socket, @MessageBody() businessId: string) {
    client.leave(`business_${businessId}`);
    this.logger.log(`Client ${client.id} left business room: ${businessId}`);
  }

  async getOnlineStaff(businessId: string): Promise<string[]> {
    try {
      return await this.redis.client.smembers(`staff:online:${businessId}`);
    } catch {
      return [];
    }
  }

  emitBookingUpdate(businessId: string, data: BookingUpdatePayload) {
    this.server.to(`business_${businessId}`).emit('bookingUpdated', data);
  }

  emitMessageUpdate(businessId: string, data: { clientId: string; unreadMessages: number; unreadThreads: number }) {
    this.server.to(`business_${businessId}`).emit('messageUpdated', data);
  }

  emitPlanUpdate(businessId: string, data: { plan: string; planExpiresAt: Date | null }) {
    this.server.to(`business_${businessId}`).emit('planUpdated', data);
  }

  emitNotificationCreated(businessId: string) {
    this.server.to(`business_${businessId}`).emit('notificationCreated');
  }
}
