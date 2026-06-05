import { Module } from '@nestjs/common';
import { ServiceDueController } from './service-due.controller';
import { ServiceDueService } from './service-due.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ServiceDueController],
  providers: [ServiceDueService],
})
export class ServiceDueModule {}
