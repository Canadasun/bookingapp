import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

async function build(decoded: unknown | 'throw') {
  const prisma = { user: { update: jest.fn().mockResolvedValue({}) } };
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
    ],
  }).compile();
  return { svc: module.get<AuthService>(AuthService), prisma };
}

describe('AuthService.verifyEmail', () => {
  it('sets emailVerified for a valid verify token', async () => {
    const { svc, prisma } = await build({ sub: 'u1', kind: 'verify' });
    await expect(svc.verifyEmail('tok')).resolves.toEqual({ ok: true });
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
