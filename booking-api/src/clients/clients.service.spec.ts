import { ForbiddenException } from '@nestjs/common';
import { ClientsService } from './clients.service';

describe('ClientsService.setBlocked', () => {
  function makePrisma(plan: string, clientOverrides: Record<string, unknown> = {}) {
    const client = { id: 'c1', businessId: 'biz1', isBlocked: false, blockedReason: null,
      appointments: [], payments: [], stripeCustomerId: null, squareCustomerId: null, squareCardId: null, userId: null,
      ...clientOverrides };
    return {
      business: { findUnique: jest.fn().mockResolvedValue({ plan }) },
      client: {
        findFirst: jest.fn().mockResolvedValue(client),
        update: jest.fn().mockResolvedValue({ ...client, isBlocked: true, blockedReason: 'no-shows' }),
      },
      payment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 0, refundedCents: 0 } }) },
    };
  }

  it('blocks a client on a paid plan', async () => {
    const prisma = makePrisma('BASIC');
    const svc = new ClientsService(prisma as never);
    const result = await svc.setBlocked('c1', 'biz1', true, 'no-shows');
    expect(prisma.client.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { isBlocked: true, blockedReason: 'no-shows' },
    }));
    expect(result.isBlocked).toBe(true);
  });

  it('clears blockedReason when unblocking', async () => {
    const prisma = makePrisma('PRO', { isBlocked: true, blockedReason: 'no-shows' });
    (prisma.client.update as jest.Mock).mockResolvedValue({ id: 'c1', businessId: 'biz1', isBlocked: false, blockedReason: null });
    const svc = new ClientsService(prisma as never);
    await svc.setBlocked('c1', 'biz1', false);
    expect(prisma.client.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { isBlocked: false, blockedReason: null },
    }));
  });

  it('rejects blocking on a FREE plan', async () => {
    const prisma = makePrisma('FREE');
    const svc = new ClientsService(prisma as never);
    await expect(svc.setBlocked('c1', 'biz1', true)).rejects.toThrow(ForbiddenException);
    expect(prisma.client.update).not.toHaveBeenCalled();
  });
});
