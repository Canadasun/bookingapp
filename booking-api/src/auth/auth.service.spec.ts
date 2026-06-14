import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthLockService } from './auth-lock.service';
import { RedisService } from '../common/redis/redis.service';

async function build(decoded: unknown | 'throw') {
  const prisma = { user: { update: jest.fn().mockResolvedValue({ role: 'OWNER' }) } };
  const jwt = {
    verify: jest.fn().mockImplementation(() => {
      if (decoded === 'throw') throw new Error('bad token');
      return decoded;
    }),
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: JwtService, useValue: jwt },
      { provide: PrismaService, useValue: prisma },
      { provide: NotificationsService, useValue: {} },
      { provide: AuthLockService, useValue: { isLocked: jest.fn().mockResolvedValue(false), recordFailure: jest.fn(), clearFailures: jest.fn() } },
      { provide: RedisService, useValue: { client: { set: jest.fn().mockResolvedValue('OK'), exists: jest.fn().mockResolvedValue(0) } } },
    ],
  }).compile();
  return { svc: module.get<AuthService>(AuthService), prisma };
}

describe('AuthService.verifyEmail', () => {
  it('sets emailVerified for a valid verify token', async () => {
    const { svc, prisma } = await build({ sub: 'u1', kind: 'verify', jti: 'verify-1' });
    await expect(svc.verifyEmail('tok')).resolves.toEqual({ ok: true, role: 'OWNER' });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { emailVerified: true } });
  });

  it('rejects a token with the wrong kind', async () => {
    const { svc, prisma } = await build({ sub: 'u1', kind: 'reset' });
    await expect(svc.verifyEmail('tok')).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid/expired token', async () => {
    const { svc } = await build('throw');
    await expect(svc.verifyEmail('tok')).rejects.toThrow(BadRequestException);
  });
});

describe('AuthService SMS 2FA phone resolution', () => {
  function buildResolver(prisma: Record<string, unknown>) {
    const mockAuthLock = { isLocked: jest.fn().mockResolvedValue(false), recordFailure: jest.fn(), clearFailures: jest.fn() } as unknown as AuthLockService;
    const mockRedis = { client: { set: jest.fn(), exists: jest.fn().mockResolvedValue(0) } } as unknown as RedisService;
    return new AuthService(
      prisma as unknown as PrismaService,
      {} as JwtService,
      { sendOtp: jest.fn() } as unknown as NotificationsService,
      mockAuthLock,
      mockRedis,
    ) as unknown as { resolveTwoFactorSmsPhone(user: Record<string, unknown>): Promise<string | null> };
  }

  it('uses the phone saved directly on the user first', async () => {
    const svc = buildResolver({
      client: { findFirst: jest.fn() },
      business: { findUnique: jest.fn() },
    });

    await expect(svc.resolveTwoFactorSmsPhone({ id: 'u1', email: 'a@example.com', phone: '825 964 0641', businessId: 'b1' }))
      .resolves.toBe('+18259640641');
  });

  it('falls back to a linked client phone', async () => {
    const prisma = {
      client: { findFirst: jest.fn().mockResolvedValue({ phone: '825 964 0641' }) },
      business: { findUnique: jest.fn() },
    };
    const svc = buildResolver(prisma);

    await expect(svc.resolveTwoFactorSmsPhone({ id: 'u1', email: 'a@example.com', phone: null, businessId: null }))
      .resolves.toBe('+18259640641');
    expect(prisma.client.findFirst).toHaveBeenCalled();
  });

  it('falls back to the business phone for owner and staff accounts', async () => {
    const prisma = {
      client: { findFirst: jest.fn().mockResolvedValue(null) },
      business: { findUnique: jest.fn().mockResolvedValue({ phone: '825 964 0641' }) },
    };
    const svc = buildResolver(prisma);

    await expect(svc.resolveTwoFactorSmsPhone({ id: 'u1', email: 'owner@example.com', phone: null, businessId: 'b1' }))
      .resolves.toBe('+18259640641');
  });

  it('returns null when no usable phone is on file', async () => {
    const prisma = {
      client: { findFirst: jest.fn().mockResolvedValue(null) },
      business: { findUnique: jest.fn().mockResolvedValue({ phone: null }) },
    };
    const svc = buildResolver(prisma);

    await expect(svc.resolveTwoFactorSmsPhone({ id: 'u1', email: 'owner@example.com', phone: null, businessId: 'b1' }))
      .resolves.toBeNull();
  });
});

describe('AuthService trusted device recognition', () => {
  it('treats browser version upgrades as the same normalized device', () => {
    const svc = new AuthService(
      {} as PrismaService,
      {} as JwtService,
      {} as NotificationsService,
      {} as AuthLockService,
      {} as RedisService,
    ) as unknown as { normalizedDeviceKey(userAgent?: string, ip?: string): string };

    const before = svc.normalizedDeviceKey(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36',
      '203.0.113.10',
    );
    const after = svc.normalizedDeviceKey(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36',
      '203.0.113.10',
    );

    expect(after).toBe(before);
  });
});
