import { Test } from '@nestjs/testing';
import { ReferralsService } from './referrals.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReferralsService.claimPendingReward', () => {
  let service: ReferralsService;
  const referral = { updateMany: jest.fn(), findUnique: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [ReferralsService, { provide: PrismaService, useValue: { referral } }],
    }).compile();
    service = mod.get(ReferralsService);
  });

  it('returns the referrer id the first time a pending reward is claimed', async () => {
    referral.updateMany.mockResolvedValue({ count: 1 });
    referral.findUnique.mockResolvedValue({ referrerBusinessId: 'biz-referrer' });
    await expect(service.claimPendingReward('biz-referred')).resolves.toBe('biz-referrer');
    expect(referral.updateMany).toHaveBeenCalledWith({
      where: { referredBusinessId: 'biz-referred', status: 'PENDING' },
      data: { status: 'REWARDED' },
    });
  });

  it('returns null when there is no pending reward (already rewarded / none)', async () => {
    referral.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.claimPendingReward('biz-referred')).resolves.toBeNull();
    expect(referral.findUnique).not.toHaveBeenCalled();
  });
});
