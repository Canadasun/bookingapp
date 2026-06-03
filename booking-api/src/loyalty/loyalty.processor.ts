import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LoyaltyService } from './loyalty.service';
import { NOTIFICATION_QUEUE } from '../notifications/notifications.service';

@Processor(NOTIFICATION_QUEUE)
export class LoyaltyProcessor extends WorkerHost {
  constructor(private loyaltyService: LoyaltyService) {
    super();
  }

  async process(job: Job<any>) {
    if (job.name === 'scan-lapsed-clients') {
      await this.loyaltyService.scanAndQueueReminders();
    }
  }
}
