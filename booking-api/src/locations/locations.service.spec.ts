import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  function setup(options: {
    plan?: 'FREE' | 'BASIC' | 'PRO' | 'UNLIMITED';
    activeCount?: number;
    location?: { id: string; businessId: string; active: boolean } | null;
  } = {}) {
    const location = options.location === undefined
      ? { id: 'loc-1', businessId: 'biz-1', active: false }
      : options.location;
    const prisma = {
      business: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ plan: options.plan ?? 'PRO' }),
      },
      location: {
        count: jest.fn().mockResolvedValue(options.activeCount ?? 0),
        findFirst: jest.fn().mockResolvedValue(location),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'new-location', active: true, ...data })),
        update: jest.fn().mockImplementation(({ data }) => ({ ...location, ...data })),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      appointment: { count: jest.fn().mockResolvedValue(0) },
      invoice: { count: jest.fn().mockResolvedValue(0) },
    };
    return { service: new LocationsService(prisma as never), prisma };
  }

  it('enforces the plan limit when creating an active location', async () => {
    const { service, prisma } = setup({ plan: 'PRO', activeCount: 2 });

    await expect(service.create('biz-1', { name: 'Third branch' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.location.create).not.toHaveBeenCalled();
  });

  it('prevents deactivate-create-reactivate plan-limit bypasses', async () => {
    const { service, prisma } = setup({
      plan: 'PRO',
      activeCount: 2,
      location: { id: 'loc-3', businessId: 'biz-1', active: false },
    });

    await expect(service.update('loc-3', 'biz-1', { active: true }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.location.update).not.toHaveBeenCalled();
  });

  it('does not apply the activation limit to ordinary edits', async () => {
    const { service, prisma } = setup({
      plan: 'PRO',
      activeCount: 2,
      location: { id: 'loc-1', businessId: 'biz-1', active: true },
    });

    await service.update('loc-1', 'biz-1', { name: 'Renamed branch' });

    expect(prisma.business.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(prisma.location.update).toHaveBeenCalled();
  });

  it('keeps updates tenant scoped', async () => {
    const { service } = setup({ location: null });
    await expect(service.update('foreign-location', 'biz-1', { name: 'Nope' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('preserves branch attribution by refusing to delete a location with history', async () => {
    const { service, prisma } = setup({
      location: { id: 'loc-1', businessId: 'biz-1', active: true },
    });
    prisma.appointment.count.mockResolvedValue(1);

    await expect(service.remove('loc-1', 'biz-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.location.delete).not.toHaveBeenCalled();
  });

  it('persists branch deposit and cancellation overrides', async () => {
    const { service, prisma } = setup();

    await service.create('biz-1', {
      name: 'Downtown',
      requireDeposit: true,
      depositPercent: 30,
      cancellationWindowMinutes: 2880,
      cancellationPolicy: '  Give us 48 hours notice.  ',
    });

    expect(prisma.location.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requireDeposit: true,
        depositPercent: 30,
        cancellationWindowMinutes: 2880,
        cancellationPolicy: 'Give us 48 hours notice.',
      }),
    });
  });

  it('can clear branch policy overrides back to business defaults', async () => {
    const { service, prisma } = setup();

    await service.update('loc-1', 'biz-1', {
      requireDeposit: null,
      depositPercent: null,
      cancellationWindowMinutes: null,
      cancellationPolicy: null,
    });

    expect(prisma.location.update).toHaveBeenCalledWith({
      where: { id: 'loc-1', businessId: 'biz-1' },
      data: expect.objectContaining({
        requireDeposit: null,
        depositPercent: null,
        cancellationWindowMinutes: null,
        cancellationPolicy: null,
      }),
    });
  });
});
