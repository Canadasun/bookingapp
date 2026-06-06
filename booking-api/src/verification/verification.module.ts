import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController, AdminVerificationController, AdminOverviewController } from './verification.controller';

@Module({
  controllers: [VerificationController, AdminVerificationController, AdminOverviewController],
  providers: [VerificationService],
})
export class VerificationModule {}
