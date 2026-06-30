import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthLockService } from './auth-lock.service';
import { RedisService } from '../common/redis/redis.service';
import * as bcrypt from 'bcryptjs';

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

describe('AuthService.register', () => {
  it('creates labeled dashboard demo examples for new owner accounts', async () => {
    const tx = {
      business: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'biz1' }),
        update: jest.fn()
          .mockResolvedValueOnce({ id: 'biz1' })
          .mockResolvedValueOnce({ invoiceSeq: 1 }),
      },
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'u1',
          name: 'Owner',
          email: 'owner@example.com',
          role: 'OWNER',
          businessId: 'biz1',
          mustResetPassword: false,
          emailVerified: false,
          twoFactorEnabled: false,
          twoFactorMethod: 'EMAIL',
        }),
      },
      staff: {
        create: jest.fn().mockResolvedValue({ id: 'staff1' }),
        update: jest.fn().mockResolvedValue({ id: 'staff1' }),
      },
      privacyConsent: { createMany: jest.fn().mockResolvedValue({ count: 4 }) },
      businessHours: { createMany: jest.fn().mockResolvedValue({ count: 5 }) },
      location: { create: jest.fn().mockResolvedValue({ id: 'loc1' }) },
      resource: { create: jest.fn().mockResolvedValue({ id: 'resource1' }) },
      serviceCategory: { create: jest.fn().mockResolvedValue({ id: 'category1' }) },
      service: { create: jest.fn().mockResolvedValue({ id: 'svc1', name: 'Demo Consultation' }) },
      staffService: { create: jest.fn().mockResolvedValue({}) },
      availabilityRule: { createMany: jest.fn().mockResolvedValue({ count: 5 }) },
      client: { create: jest.fn().mockResolvedValue({ id: 'client1' }) },
      appointment: {
        create: jest.fn()
          .mockResolvedValueOnce({ id: 'apt-upcoming' })
          .mockResolvedValueOnce({ id: 'apt-completed' }),
      },
      payment: { create: jest.fn().mockResolvedValue({ id: 'pay1' }) },
      refund: { create: jest.fn().mockResolvedValue({ id: 'refund1' }) },
      transaction: { create: jest.fn().mockResolvedValue({ id: 'txn1' }) },
      invoice: { create: jest.fn().mockResolvedValue({ id: 'inv1' }) },
      staffTask: { create: jest.fn().mockResolvedValue({ id: 'task1' }) },
      followUpPolicy: { create: jest.fn().mockResolvedValue({ id: 'policy1' }) },
      serviceDue: { create: jest.fn().mockResolvedValue({ id: 'due1' }) },
      waitlistEntry: { create: jest.fn().mockResolvedValue({ id: 'wait1' }) },
      message: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      messageThreadState: { create: jest.fn().mockResolvedValue({ id: 'thread1' }) },
      offer: { create: jest.fn().mockResolvedValue({ id: 'offer1' }) },
      promoCode: { create: jest.fn().mockResolvedValue({ id: 'promo1' }) },
      campaign: { create: jest.fn().mockResolvedValue({ id: 'campaign1' }) },
      giftCard: { create: jest.fn().mockResolvedValue({ id: 'gift1' }) },
      giftCardRedemption: { create: jest.fn().mockResolvedValue({ id: 'gift-redemption1' }) },
      package: { create: jest.fn().mockResolvedValue({ id: 'package1', name: 'Demo 5-Visit Package' }) },
      clientPackage: { create: jest.fn().mockResolvedValue({ id: 'client-package1' }) },
      packageRedemption: { create: jest.fn().mockResolvedValue({ id: 'package-redemption1' }) },
      membershipPlan: { create: jest.fn().mockResolvedValue({ id: 'membership-plan1' }) },
      clientMembership: { create: jest.fn().mockResolvedValue({ id: 'membership1' }) },
      notification: { create: jest.fn().mockResolvedValue({ id: 'notification1' }) },
      notificationDelivery: { create: jest.fn().mockResolvedValue({ id: 'delivery1' }) },
      refreshSession: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
      refreshSession: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const jwt = { sign: jest.fn().mockReturnValue('token') };
    const notifications = {
      sendWelcome: jest.fn().mockResolvedValue(undefined),
      sendVerifyEmail: jest.fn().mockResolvedValue(undefined),
    };
    const svc = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      notifications as unknown as NotificationsService,
      { isLocked: jest.fn() } as unknown as AuthLockService,
      { client: { set: jest.fn(), exists: jest.fn() } } as unknown as RedisService,
    );

    const result = await svc.register({
      name: 'Owner',
      email: 'owner@example.com',
      password: 'password123',
      role: 'OWNER',
      businessName: 'Demo Salon',
      businessPhone: '+1 416 555 0100',
      timezone: 'America/Toronto',
      privacyConsentAccepted: true,
      consentVersion: 'v1',
      marketingConsent: false,
      trackingConsent: false,
      locale: 'en',
    });
    // Demo data seeding is fire-and-forget (void); flush microtasks so the
    // createOwnerDemoData chain completes before assertions run.
    await new Promise((r) => setImmediate(r));

    expect(result.user.businessId).toBe('biz1');
    expect(tx.staff.create).toHaveBeenCalledWith({ data: { userId: 'u1', businessId: 'biz1', active: true } });
    expect(tx.business.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'biz1' },
      data: expect.objectContaining({
        intakeQuestions: expect.any(Array),
        bookingPageSettings: expect.objectContaining({ headline: 'Book with Demo Salon' }),
        notificationSettings: expect.objectContaining({ emailConfirmation: true }),
      }),
    }));
    expect(tx.service.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'Demo Consultation' }) }));
    expect(tx.appointment.create).toHaveBeenCalledTimes(2);
    expect(tx.client.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'Demo Client' }) }));
    expect(tx.waitlistEntry.create).toHaveBeenCalled();
    expect(tx.message.createMany).toHaveBeenCalled();
    expect(tx.invoice.create).toHaveBeenCalled();
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: 'Demo examples added' }) }));
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

describe('AuthService.setTwoFactor', () => {
  async function buildTwoFactorService() {
    const passwordHash = await bcrypt.hash('current-password', 4);
    const user = {
      id: 'u1', role: 'OWNER', passwordHash, twoFactorEnabled: false,
      twoFactorRecoveryCodes: [], twoFactorMethod: 'EMAIL',
    };
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...user, ...data })),
      },
    };
    const svc = new AuthService(
      prisma as unknown as PrismaService,
      {} as JwtService,
      {} as NotificationsService,
      {} as AuthLockService,
      {} as RedisService,
    );
    return { svc, prisma };
  }

  it('rejects a 2FA change when the current password is wrong', async () => {
    const { svc, prisma } = await buildTwoFactorService();

    await expect(svc.setTwoFactor('u1', true, 'EMAIL', 'wrong-password'))
      .rejects.toThrow(UnauthorizedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows a 2FA change after current-password verification', async () => {
    const { svc, prisma } = await buildTwoFactorService();

    await expect(svc.setTwoFactor('u1', true, 'EMAIL', 'current-password'))
      .resolves.toMatchObject({ ok: true, twoFactorEnabled: true });
    expect(prisma.user.update).toHaveBeenCalled();
  });
});
