import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health.controller';
import { NOTIFICATION_QUEUE } from '../notifications/notifications.service';

@Module({
  imports: [
    TerminusModule,
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
