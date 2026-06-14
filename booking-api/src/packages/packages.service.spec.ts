import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { PrismaService } from '../prisma/prisma.service';

const BIZ = 'biz1';

function makeCP(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cp1', businessId: BIZ, clientId: 'c1', name: '5x Haircut',
    serviceId: 'svc1', creditsTotal: 5, creditsRemaining: 3,
    status: 'ACTIVE', expiresAt: null, redemptions: [],
    client: { id: 'c1', name: 'Ann', email: 'a@b.com' },
    ...over,
  };
}

function build() {
  const prisma: Record<string, any> = {
    package: { findFirst: jest.fn() },
    client: { findFirst: jest.fn() },
    clientPackage: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    packageRedemption: { create: jest.fn() },
  };
  prisma.$transaction = jest.fn().mockImplementation((operation: unknown) =>
    typeof operation === 'function' ? operation(prisma) : Promise.all(operation as Promise<unknown>[]),
  );
  return prisma;
}

async function svcWith(prisma: Record<string, unknown>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [PackagesService, { provide: PrismaService, useValue: prisma }],
  }).compile();
  return module.get(PackagesService);
}

describe('PackagesService.redeem', () => {
  it('consumes one credit and stays ACTIVE while credits remain', async () => {
    const prisma = build();
    (prisma.clientPackage.findFirst as jest.Mock).mockResolvedValue(makeCP({ creditsRemaining: 3 }));
    (prisma.clientPackage.update as jest.Mock).mockResolvedValue(makeCP({ creditsRemaining: 2 }));
    (prisma.packageRedemption.create as jest.Mock).mockResolvedValue({});
    const svc = await svcWith(prisma);

    const res = await svc.redeem(BIZ, 'cp1', {});

    expect(res).toEqual({ creditsRemaining: 2, status: 'ACTIVE' });
    expect(prisma.clientPackage.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { creditsRemaining: 2, status: 'ACTIVE' } }),
    );
  });

  it('marks the package USED when the last credit is consumed', async () => {
    const prisma = build();
    (prisma.clientPackage.findFirst as jest.Mock).mockResolvedValue(makeCP({ creditsRemaining: 1 }));
    (prisma.clientPackage.update as jest.Mock).mockResolvedValue(makeCP({ creditsRemaining: 0, status: 'USED' }));
    (prisma.packageRedemption.create as jest.Mock).mockResolvedValue({});
    const svc = await svcWith(prisma);

    const res = await svc.redeem(BIZ, 'cp1', {});

    expect(res.status).toBe('USED');
  });

  it('rejects redeeming with no credits left', async () => {
    const prisma = build();
    (prisma.clientPackage.findFirst as jest.Mock).mockResolvedValue(makeCP({ creditsRemaining: 0 }));
    const svc = await svcWith(prisma);
    await expect(svc.redeem(BIZ, 'cp1', {})).rejects.toThrow(BadRequestException);
  });

  it('rejects a voided package', async () => {
    const prisma = build();
    (prisma.clientPackage.findFirst as jest.Mock).mockResolvedValue(makeCP({ status: 'VOID' }));
    const svc = await svcWith(prisma);
    await expect(svc.redeem(BIZ, 'cp1', {})).rejects.toThrow(BadRequestException);
  });

  it('rejects an expired package', async () => {
    const prisma = build();
    (prisma.clientPackage.findFirst as jest.Mock).mockResolvedValue(makeCP({ expiresAt: new Date('2020-01-01') }));
    const svc = await svcWith(prisma);
    await expect(svc.redeem(BIZ, 'cp1', {})).rejects.toThrow(BadRequestException);
  });
});

describe('PackagesService.issue', () => {
  it('snapshots name/credits from a template', async () => {
    const prisma = build();
    (prisma.client.findFirst as jest.Mock).mockResolvedValue({ id: 'c1' });
    (prisma.package.findFirst as jest.Mock).mockResolvedValue({ id: 'pk1', businessId: BIZ, name: '5x Haircut', serviceId: 'svc1', credits: 5 });
    (prisma.clientPackage.create as jest.Mock).mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'cp1', ...data }));
    const svc = await svcWith(prisma);

    const cp = await svc.issue(BIZ, { clientId: 'c1', packageId: 'pk1' });

    expect(cp.creditsTotal).toBe(5);
    expect(cp.creditsRemaining).toBe(5);
    expect(cp.name).toBe('5x Haircut');
  });

  it('throws NotFound for an unknown client', async () => {
    const prisma = build();
    (prisma.client.findFirst as jest.Mock).mockResolvedValue(null);
    const svc = await svcWith(prisma);
    await expect(svc.issue(BIZ, { clientId: 'nope', name: 'X', credits: 3 })).rejects.toThrow(NotFoundException);
  });
});
