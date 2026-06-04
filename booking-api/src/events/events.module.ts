import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { EventsController } from './events.controller';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [EventsController],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
