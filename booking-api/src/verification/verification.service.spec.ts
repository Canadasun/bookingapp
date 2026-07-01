import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VerificationService } from './verification.service';

describe('VerificationService complimentary plans', () => {
  function setup(business: Record<string, unknown> | null) {
    const prisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue(business),
        update: jest.fn().mockImplementation(({ data }) => ({
          id: 'biz-1',
          ...data,
        })),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const notifications = { sendCompPlanGranted: jest.fn().mockResolvedValue(undefined) };
    return { service: new VerificationService(prisma as never, notifications as never), prisma, notifications };
  }

  it('grants temporary access and records the previous plan', async () => {
    const { service, prisma, notifications } = setup({
      id: 'biz-1',
      plan: 'FREE',
      complimentaryPlanExpiresAt: null,
      complimentaryPreviousPlan: null,
      subscription: null,
    });

    const result = await service.grantComplimentaryPlan('biz-1', 'UNLIMITED', 3, 'admin-1');

    expect(result.plan).toBe('UNLIMITED');
    expect(prisma.business.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        plan: 'UNLIMITED',
        complimentaryPreviousPlan: 'FREE',
        complimentaryPlanExpiresAt: expect.any(Date),
      }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'ADMIN_COMPLIMENTARY_PLAN_GRANTED',
        userId: 'admin-1',
      }),
    }));
    expect(notifications.sendCompPlanGranted).toHaveBeenCalledWith(
      'biz-1',
      expect.objectContaining({ plan: 'UNLIMITED', expiresAt: expect.any(String) }),
    );
  });

  it('preserves the original plan when extending an active grant', async () => {
    const { service, prisma } = setup({
      id: 'biz-1',
      plan: 'PRO',
      complimentaryPlanExpiresAt: new Date(Date.now() + 86_400_000),
      complimentaryPreviousPlan: 'BASIC',
      subscription: null,
    });

    await service.grantComplimentaryPlan('biz-1', 'UNLIMITED', 3, 'admin-1');

    expect(prisma.business.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ complimentaryPreviousPlan: 'BASIC' }),
    }));
  });

  it('rejects grants for actively billed businesses', async () => {
    const { service, prisma } = setup({
      id: 'biz-1',
      plan: 'PRO',
      complimentaryPlanExpiresAt: null,
      complimentaryPreviousPlan: null,
      subscription: { status: 'ACTIVE' },
    });

    await expect(service.grantComplimentaryPlan('biz-1', 'UNLIMITED', 3, 'admin-1'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it('rejects unknown businesses', async () => {
    const { service } = setup(null);
    await expect(service.grantComplimentaryPlan('missing', 'PRO', 3, 'admin-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
