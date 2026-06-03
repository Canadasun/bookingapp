import { Module } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyProcessor } from './loyalty.processor';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [LoyaltyService, LoyaltyProcessor],
})
export class LoyaltyModule {}
