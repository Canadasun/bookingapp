import { CampaignsService } from './campaigns.service';

describe('CampaignsService audience filters', () => {
  it('requires email recipients to have email addresses', async () => {
    const prisma = {
      client: { count: jest.fn().mockResolvedValue(0) },
    };
    const svc = new CampaignsService(prisma as never, {} as never);

    await svc.audienceCount('biz1', 'EMAIL', 'ALL');

    expect(prisma.client.count).toHaveBeenCalledWith({
      where: { businessId: 'biz1', email: { not: null }, marketingOptOut: false },
    });
  });

  it('requires SMS recipients to have phone numbers', async () => {
    const prisma = {
      client: { count: jest.fn().mockResolvedValue(0) },
    };
    const svc = new CampaignsService(prisma as never, {} as never);

    await svc.audienceCount('biz1', 'SMS', 'ALL');

    expect(prisma.client.count).toHaveBeenCalledWith({
      where: { businessId: 'biz1', phone: { not: null }, marketingOptOut: false },
    });
  });
});
