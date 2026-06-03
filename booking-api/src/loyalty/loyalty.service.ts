import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_QUEUE } from '../notifications/notifications.service';
import { subWeeks, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class LoyaltyService implements OnModuleInit {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUE) private queue: Queue,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Schedule a daily scan at 10:00 AM
    await this.queue.add(
      'scan-lapsed-clients',
      {},
      {
        repeat: { pattern: '0 10 * * *' },
        jobId: 'daily-loyalty-scan',
        removeOnComplete: true,
      },
    );
    this.logger.log('Daily loyalty scan scheduled for 10:00 AM');
  }

  // This method will be called by the processor when the 'scan-lapsed-clients' job runs.
  async scanAndQueueReminders() {
    this.logger.log('Starting loyalty scan for lapsed clients...');

    // A client is "lapsed" if their last completed appointment was exactly 4 weeks ago
    // and they have no future appointments scheduled.
    const fourWeeksAgo = subWeeks(new Date(), 4);
    const startOfTargetDay = startOfDay(fourWeeksAgo);
    const endOfTargetDay = endOfDay(fourWeeksAgo);

    // Find businesses on PAID plans (Loyalty is a premium feature)
    const paidBusinesses = await this.prisma.business.findMany({
      where: { plan: { in: ['BASIC', 'PRO'] } },
      select: { id: true },
    });

    const bizIds = paidBusinesses.map(b => b.id);
    if (!bizIds.length) return;

    // Find clients whose last visit was 4 weeks ago
    const lapsedClients = await this.prisma.client.findMany({
      where: {
        businessId: { in: bizIds },
        appointments: {
          some: {
            status: 'COMPLETED',
            startsAt: {
              gte: startOfTargetDay,
              lte: endOfTargetDay,
            },
          },
          none: {
            startsAt: { gte: new Date() },
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
        },
      },
      include: { business: true },
    });

    this.logger.log(`Found ${lapsedClients.length} lapsed clients across ${bizIds.length} businesses.`);

    for (const client of lapsedClients) {
      await this.queue.add(
        'rebook-reminder',
        { clientId: client.id, businessId: client.businessId },
        { removeOnComplete: true, attempts: 3 },
      );
    }
  }
}
