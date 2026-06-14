import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NOTIFICATION_QUEUE } from '../notifications/notifications.service';

@ApiTags('health')
@Controller('healthz')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaIndicator: PrismaHealthIndicator,
    private prisma: PrismaService,
    @InjectQueue(NOTIFICATION_QUEUE) private queue: Queue,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    // Run the full infrastructure check but return only a single boolean to
    // external callers — internal status (DB up/down, Redis up/down) should not
    // be visible to unauthenticated observers.
    const result = await this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma),
      async () => {
        try {
          const client = await this.queue.client;
          const ping = await (client as unknown as { ping(): Promise<string> }).ping();
          return { redis: { status: ping === 'PONG' ? 'up' : 'down' } };
        } catch {
          return { redis: { status: 'down' } };
        }
      },
    ]);
    // Expose only pass/fail — no component details to unauthenticated callers.
    return { status: result.status === 'ok' ? 'ok' : 'degraded' };
  }
}
