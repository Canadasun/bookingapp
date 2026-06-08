import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController, AdminVerificationController, AdminOverviewController } from './verification.controller';
import { BusinessesModule } from '../businesses/businesses.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [BusinessesModule, AuthModule],
  controllers: [VerificationController, AdminVerificationController, AdminOverviewController],
  providers: [VerificationService],
})
export class VerificationModule {}
