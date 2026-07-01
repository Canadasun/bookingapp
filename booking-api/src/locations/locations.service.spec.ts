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
        // findFirst serves two callers: the slug-uniqueness probe (where has a
        // `slug`) must report "no clash" by default, while the tenant lookup
        // (where has `id`) returns the configured location.
        findFirst: jest.fn().mockImplementation((args?: { where?: Record<string, unknown> }) =>
          Promise.resolve(args?.where && 'slug' in args.where ? null : location),
        ),
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

  it('generates a URL-safe branch slug from the name on create', async () => {
    const { service, prisma } = setup();

    await service.create('biz-1', { name: 'Downtown Studio!' });

    expect(prisma.location.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ slug: 'downtown-studio' }),
    });
  });

  it('dedupes a colliding branch slug within the business', async () => {
    const { service, prisma } = setup();
    // "downtown" is taken; "downtown-2" is free.
    prisma.location.findFirst.mockImplementation((args?: { where?: Record<string, unknown> }) =>
      Promise.resolve(args?.where?.slug === 'downtown' ? { id: 'existing' } : null),
    );

    await service.create('biz-1', { name: 'Downtown' });

    expect(prisma.location.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ slug: 'downtown-2' }),
    });
  });

  it('keeps the branch slug stable when the name is edited', async () => {
    const { service, prisma } = setup({
      location: { id: 'loc-1', businessId: 'biz-1', active: true },
    });

    await service.update('loc-1', 'biz-1', { name: 'Renamed branch' });

    const updateArg = prisma.location.update.mock.calls[0][0];
    expect(updateArg.data).not.toHaveProperty('slug');
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
