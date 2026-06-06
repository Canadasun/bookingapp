import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { PaymentsService } from './payments.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { SquareModule } from '../square/square.module';

@Module({
  imports: [NotificationsModule, ReferralsModule, SquareModule],
  controllers: [PaymentsController, SubscriptionsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
