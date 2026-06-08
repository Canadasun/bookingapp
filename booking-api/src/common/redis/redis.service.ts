import { Injectable, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: IORedis;
  constructor() {
    this.client = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  onModuleDestroy() { this.client.disconnect(); }
}
