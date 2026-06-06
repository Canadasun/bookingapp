import { InboxService } from './inbox.service';
import { PrismaService } from '../prisma/prisma.service';

function build() {
  const prisma = {
    notification: {
      create: jest.fn().mockResolvedValue({ id: 'n1' }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(3),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    notificationDelivery: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'owner1' }, { id: 'owner2' }]) },
  };
  return { svc: new InboxService(prisma as unknown as PrismaService), prisma };
}

describe('InboxService', () => {
  it('markRead is scoped to the user (cannot mark another user’s notification)', async () => {
    const { svc, prisma } = build();
    await svc.markRead('user1', 'n1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { id: 'n1', userId: 'user1' }, data: { read: true } });
  });

  it('unreadCount counts only unread for the user', async () => {
    const { svc, prisma } = build();
    await expect(svc.unreadCount('user1')).resolves.toBe(3);
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: 'user1', read: false } });
  });

  it('markAllRead flips all unread for the user', async () => {
    const { svc, prisma } = build();
    await svc.markAllRead('user1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { userId: 'user1', read: false }, data: { read: true } });
  });

  it('clear deletes only the signed-in user notifications', async () => {
    const { svc, prisma } = build();
    await svc.clear('user1');
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user1' } });
  });

  it('notifyBusinessOwners fans out one notification per owner', async () => {
    const { svc, prisma } = build();
    await svc.notifyBusinessOwners('biz1', { title: 'New booking', body: 'x' });
    const arg = prisma.notification.createMany.mock.calls[0][0];
    expect(arg.data).toHaveLength(2);
    expect(arg.data[0]).toMatchObject({ userId: 'owner1', title: 'New booking' });
  });

  it('deliveryLogs scopes owner delivery history to their business', async () => {
    const { svc, prisma } = build();
    await svc.deliveryLogs({ id: 'u1', role: 'OWNER', businessId: 'biz1' } as any);
    expect(prisma.notificationDelivery.findMany).toHaveBeenCalledWith({
      where: { businessId: 'biz1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });
});
