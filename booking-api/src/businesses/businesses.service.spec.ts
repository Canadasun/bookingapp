import { BusinessesService } from './businesses.service';
import { PrismaService } from '../prisma/prisma.service';

function build() {
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'biz1',
        timezone: 'America/Edmonton',
        verificationStatus: 'VERIFIED',
      }),
    },
    staff: {
      findFirst: jest.fn().mockResolvedValue({ id: 'staff1' }),
    },
    appointment: {
      findMany: jest.fn()
        .mockResolvedValueOnce([{ id: 'today' }])
        .mockResolvedValueOnce([{ id: 'upcoming' }])
        .mockResolvedValueOnce([
          { service: { name: 'Cut' } },
          { service: { name: 'Cut' } },
          { service: { name: 'Color' } },
        ]),
      count: jest.fn()
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1),
    },
    notification: { count: jest.fn().mockResolvedValue(3) },
    message: { findMany: jest.fn().mockResolvedValue([
      { clientId: 'c1', createdAt: new Date('2026-06-15T16:00:00.000Z') },
      { clientId: 'c1', createdAt: new Date('2026-06-15T16:05:00.000Z') },
    ]) },
    messageThreadState: { findMany: jest.fn().mockResolvedValue([]) },
    payment: {
      findMany: jest.fn().mockResolvedValue([{ amountCents: 10000, refundedCents: 1500 }]),
      count: jest.fn().mockResolvedValue(4),
    },
    waitlistEntry: { count: jest.fn().mockResolvedValue(5) },
    notificationDelivery: { count: jest.fn().mockResolvedValue(6) },
    client: { count: jest.fn().mockResolvedValue(8) },
  };
  return {
    service: new BusinessesService(prisma as unknown as PrismaService),
    prisma,
  };
}

describe('BusinessesService.dashboardOverview', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T18:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns exact owner dashboard metrics from server-side aggregate queries', async () => {
    const { service, prisma } = build();

    await expect(service.dashboardOverview('biz1', {
      id: 'owner1',
      role: 'OWNER',
      businessId: 'biz1',
    })).resolves.toMatchObject({
      today: [{ id: 'today' }],
      upcoming: [{ id: 'upcoming' }],
      metrics: {
        pendingBookings: 7,
        cancelledThisWeek: 2,
        noShowsThisMonth: 1,
        completedThisWeek: 3,
        topService: 'Cut',
        unreadNotifications: 3,
        unreadMessages: 2,
        unreadThreads: 1,
        weekRevenue: 8500,
        failedPayments: 4,
        waitlistCount: 5,
        failedDeliveries: 6,
        newClientsThisMonth: 8,
      },
    });

    expect(prisma.appointment.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ take: 5 }));
    expect(prisma.payment.count).toHaveBeenCalledWith({ where: { businessId: 'biz1', status: 'FAILED' } });
    expect(prisma.client.count).toHaveBeenCalled();
  });

  it('scopes staff dashboard appointments and suppresses owner-only metrics', async () => {
    const { service, prisma } = build();

    const result = await service.dashboardOverview('biz1', {
      id: 'staff-user',
      role: 'STAFF',
      businessId: 'biz1',
    });

    expect(prisma.staff.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'staff-user', businessId: 'biz1', active: true },
    }));
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ staffId: 'staff1' }),
    }));
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
    expect(prisma.waitlistEntry.count).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.count).not.toHaveBeenCalled();
    expect(prisma.client.count).not.toHaveBeenCalled();
    expect(result.metrics).toMatchObject({
      failedPayments: 0,
      waitlistCount: 0,
      failedDeliveries: 0,
      newClientsThisMonth: 0,
    });
  });
});
