import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // In production, this should be tightened to your WEB_URL
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('EventsGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinBusiness')
  handleJoinBusiness(client: Socket, businessId: string) {
    client.join(`business_${businessId}`);
    this.logger.log(`Client ${client.id} joined business room: ${businessId}`);
  }

  @SubscribeMessage('leaveBusiness')
  handleLeaveBusiness(client: Socket, businessId: string) {
    client.leave(`business_${businessId}`);
    this.logger.log(`Client ${client.id} left business room: ${businessId}`);
  }

  emitBookingUpdate(businessId: string, data: any) {
    this.server.to(`business_${businessId}`).emit('bookingUpdated', data);
  }
}
