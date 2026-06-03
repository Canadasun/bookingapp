import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { PaymentsService } from './payments.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController, SubscriptionsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
