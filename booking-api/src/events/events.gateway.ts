import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

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

type SocketUser = { id: string; role: string; businessId: string | null };

@WebSocketGateway({ cors: { origin: corsOrigin(), credentials: true } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('EventsGateway');

  constructor(private readonly jwt: JwtService) {}

  // Authenticate at connection time using a short-lived WS ticket the client
  // fetches from GET /events/ws-ticket (authenticated via the same session). An
  // unauthenticated or invalid socket is dropped immediately — no anonymous
  // sockets, so no one can subscribe to a business they don't belong to.
  handleConnection(client: Socket) {
    const ticket =
      (client.handshake.auth?.ticket as string | undefined) ||
      (client.handshake.auth?.token as string | undefined);
    try {
      const p = this.jwt.verify(ticket ?? '', { secret: process.env.JWT_SECRET, algorithms: ['HS256'] }) as {
        sub?: string; role?: string; businessId?: string | null; kind?: string;
      };
      if (p.kind !== 'ws' || !p.sub) throw new Error('not a ws ticket');
      client.data.user = { id: p.sub, role: p.role ?? 'CLIENT', businessId: p.businessId ?? null } as SocketUser;
      this.logger.log(`Client connected: ${client.id} (user ${p.sub})`);
    } catch {
      this.logger.warn(`Rejected unauthenticated socket ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinBusiness')
  handleJoinBusiness(@ConnectedSocket() client: Socket, @MessageBody() businessId: string) {
    const user = client.data.user as SocketUser | undefined;
    // Only the business's own members (or a platform ADMIN) may listen in.
    if (!user || (user.role !== 'ADMIN' && user.businessId !== businessId)) {
      this.logger.warn(`Client ${client.id} denied join for business ${businessId}`);
      return;
    }
    client.join(`business_${businessId}`);
    this.logger.log(`Client ${client.id} joined business room: ${businessId}`);
  }

  @SubscribeMessage('leaveBusiness')
  handleLeaveBusiness(@ConnectedSocket() client: Socket, @MessageBody() businessId: string) {
    client.leave(`business_${businessId}`);
    this.logger.log(`Client ${client.id} left business room: ${businessId}`);
  }

  emitBookingUpdate(businessId: string, data: any) {
    this.server.to(`business_${businessId}`).emit('bookingUpdated', data);
  }

  emitMessageUpdate(businessId: string, data: { clientId: string; unreadMessages: number; unreadThreads: number }) {
    this.server.to(`business_${businessId}`).emit('messageUpdated', data);
  }

  emitPlanUpdate(businessId: string, data: { plan: string; planExpiresAt: Date | null }) {
    this.server.to(`business_${businessId}`).emit('planUpdated', data);
  }
}
