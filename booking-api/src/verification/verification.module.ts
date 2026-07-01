import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController, AdminVerificationController, AdminOverviewController } from './verification.controller';
import { BusinessesModule } from '../businesses/businesses.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [BusinessesModule, AuthModule, NotificationsModule],
  controllers: [VerificationController, AdminVerificationController, AdminOverviewController],
  providers: [VerificationService],
})
export class VerificationModule {}
