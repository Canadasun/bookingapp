import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

function build() {
  const prisma = {
    message: {
      create: jest.fn().mockResolvedValue({ id: 'm1', businessId: 'biz1', clientId: 'c1', content: 'I cannot find the salon', fromClient: true }),
      count: jest.fn().mockResolvedValue(2),
      groupBy: jest.fn().mockResolvedValue([{ clientId: 'c1', _count: { _all: 2 } }]),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    staff: { findFirst: jest.fn().mockResolvedValue({ id: 'staff1' }) },
    appointment: { findFirst: jest.fn().mockResolvedValue({ id: 'apt1' }) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'owner1' }]) },
    client: {
      findFirst: jest.fn().mockResolvedValue({ id: 'c1' }),
      findUnique: jest.fn().mockResolvedValue({ name: 'Jane' }),
    },
    notification: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const events = { emitMessageUpdate: jest.fn() };
  const notifications = { sendPriorityMessageAlert: jest.fn().mockResolvedValue(undefined) };
  return {
    svc: new MessagesService(
      prisma as unknown as PrismaService,
      events as unknown as EventsGateway,
      notifications as unknown as NotificationsService,
    ),
    prisma,
    events,
    notifications,
  };
}

describe('MessagesService priority unread handling', () => {
  it('alerts business users and emits unread totals immediately for a client message', async () => {
    const { svc, prisma, events, notifications } = build();

    await svc.send('biz1', 'c1', 'I cannot find the salon', true);

    expect(prisma.notification.createMany).toHaveBeenCalled();
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { role: 'OWNER' },
          expect.objectContaining({ role: 'STAFF' }),
        ]),
      }),
    }));
    expect(events.emitMessageUpdate).toHaveBeenCalledWith('biz1', {
      clientId: 'c1', unreadMessages: 2, unreadThreads: 1,
    });
    expect(notifications.sendPriorityMessageAlert).toHaveBeenCalledWith('m1');
  });

  it('returns and emits the remaining unread totals after a thread is read', async () => {
    const { svc, prisma, events } = build();
    prisma.message.count.mockResolvedValue(0);
    prisma.message.groupBy.mockResolvedValue([]);

    await expect(svc.markRead('biz1', 'c1')).resolves.toMatchObject({
      count: 2, unreadMessages: 0, unreadThreads: 0,
    });
    expect(events.emitMessageUpdate).toHaveBeenCalledWith('biz1', {
      clientId: 'c1', unreadMessages: 0, unreadThreads: 0,
    });
  });

  it('allows a staff user to access only clients assigned through appointments', async () => {
    const { svc, prisma } = build();

    await expect(svc.assertBusinessUserCanAccessClient(
      { id: 'user1', role: 'STAFF', businessId: 'biz1' },
      'biz1',
      'c1',
    )).resolves.toBeUndefined();

    expect(prisma.staff.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user1', businessId: 'biz1', active: true },
    }));
    expect(prisma.appointment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId: 'biz1', clientId: 'c1', staffId: 'staff1' },
    }));
  });

  it('rejects a staff user with no appointment for the client', async () => {
    const { svc, prisma } = build();
    prisma.appointment.findFirst.mockResolvedValueOnce(null);

    await expect(svc.assertBusinessUserCanAccessClient(
      { id: 'user1', role: 'STAFF', businessId: 'biz1' },
      'biz1',
      'c1',
    )).rejects.toThrow('FORBIDDEN_CLIENT');
  });

  it('rejects business users when the client is outside the business', async () => {
    const { svc, prisma } = build();
    prisma.client.findFirst.mockResolvedValueOnce(null);

    await expect(svc.assertBusinessUserCanAccessClient(
      { id: 'owner1', role: 'OWNER', businessId: 'biz1' },
      'biz1',
      'other-client',
    )).rejects.toThrow('FORBIDDEN_CLIENT');
  });
});
