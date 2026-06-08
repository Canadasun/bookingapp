import { Injectable } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';

const FAIL_KEY = (e: string) => `auth:fail:${e.toLowerCase().trim()}`;
const LOCK_KEY = (e: string) => `auth:lock:${e.toLowerCase().trim()}`;
const MAX_FAILURES = 10;
const FAIL_WINDOW_S = 1800;
const LOCK_TTL_S = 900;

@Injectable()
export class AuthLockService {
  constructor(private redis: RedisService) {}

  async isLocked(email: string): Promise<boolean> {
    return !!(await this.redis.client.exists(LOCK_KEY(email)));
  }

  async recordFailure(email: string): Promise<void> {
    const key = FAIL_KEY(email);
    const count = await this.redis.client.incr(key);
    await this.redis.client.expire(key, FAIL_WINDOW_S);
    if (count >= MAX_FAILURES) {
      await this.redis.client.set(LOCK_KEY(email), '1', 'EX', LOCK_TTL_S);
    }
  }

  async clearFailures(email: string): Promise<void> {
    await this.redis.client.del(FAIL_KEY(email));
  }

  /** Admin action: clear both the lock and the failure counter immediately. */
  async unlockAccount(email: string): Promise<void> {
    await this.redis.client.del(LOCK_KEY(email), FAIL_KEY(email));
  }

  async lockStatus(email: string): Promise<{ locked: boolean; failCount: number; lockTtlSeconds: number }> {
    const [exists, failRaw, ttl] = await Promise.all([
      this.redis.client.exists(LOCK_KEY(email)),
      this.redis.client.get(FAIL_KEY(email)),
      this.redis.client.ttl(LOCK_KEY(email)),
    ]);
    return {
      locked: exists === 1,
      failCount: parseInt(failRaw ?? '0', 10),
      lockTtlSeconds: exists === 1 ? Math.max(ttl, 0) : 0,
    };
  }
}
