import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController, AdminVerificationController } from './verification.controller';

@Module({
  controllers: [VerificationController, AdminVerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
