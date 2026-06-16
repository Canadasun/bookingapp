import { WaitlistService } from './waitlist.service';

describe('WaitlistService.list', () => {
  it('keeps automatically notified entries visible to owners', async () => {
    const prisma = {
      waitlistEntry: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = new WaitlistService(prisma as never);

    await svc.list('biz1');

    expect(prisma.waitlistEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId: 'biz1', status: { in: ['WAITING', 'NOTIFIED'] } },
    }));
  });
});
