import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhone } from '../common/util/phone';
import { TwilioSmsProvider } from '../notifications/providers/sms.provider';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private readonly sms = new TwilioSmsProvider();

  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
    private notifications: NotificationsService,
  ) {}

  getThread(businessId: string, clientId: string) {
    return this.prisma.message.findMany({
      where: { businessId, clientId },
      orderBy: { createdAt: 'asc' },
      take: 1000, // bound a single conversation
    });
  }

  getBusiness(id: string) {
    return this.prisma.business.findUnique({
      where: { id },
      select: { id: true, plan: true },
    });
  }

  async verifyAppointmentClient(appointmentId: string, businessId: string, clientId: string) {
    const apt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { businessId: true, clientId: true },
    });
    return apt && apt.businessId === businessId && apt.clientId === clientId;
  }

  async verifyUserClient(userId: string, businessId: string, clientId: string) {
    const [client, user] = await Promise.all([
      this.prisma.client.findUnique({
        where: { id: clientId },
        select: { businessId: true, userId: true, email: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, emailVerified: true },
      }),
    ]);
    if (!client || client.businessId !== businessId || !user) return false;
    if (client.userId === userId) return true;

    // Existing client rows may predate account linking. A verified account with
    // the same email can claim only that matching client row, in that business.
    if (user.emailVerified && client.email && client.email.toLowerCase() === user.email.toLowerCase()) {
      await this.prisma.client.update({
        where: { id: clientId },
        data: { userId },
      }).catch(() => {});
      return true;
    }
    return false;
  }

  async send(businessId: string, clientId: string, content: string, fromClient: boolean, channel: 'IN_APP' | 'SMS' = 'IN_APP') {
    const message = await this.prisma.message.create({
      data: { businessId, clientId, content, fromClient, channel },
    });
    if (fromClient) {
      await this.prisma.messageThreadState?.updateMany({
        where: { businessId, clientId },
        data: { archivedAt: null },
      });
      await this.notifyBusinessUsersOfClientMessage(businessId, clientId, content, channel);
      const unread = await this.getUnreadCount(businessId);
      this.events.emitMessageUpdate(businessId, { clientId, ...unread });
      await this.notifications.sendPriorityMessageAlert(message.id).catch(() => {});
    }
    return message;
  }

  private async notifyBusinessUsersOfClientMessage(businessId: string, clientId: string, content: string, channel: 'IN_APP' | 'SMS') {
    const [users, client] = await Promise.all([
      this.prisma.user.findMany({
        where: { businessId, role: { in: ['OWNER', 'STAFF'] } },
        select: { id: true },
      }),
      this.prisma.client.findUnique({ where: { id: clientId }, select: { name: true } }),
    ]);
    if (!users.length) return;
    const source = channel === 'SMS' ? 'text' : 'message';
    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        kind: 'SYSTEM' as const,
        title: `Urgent: new ${source} from ${client?.name ?? 'a client'}`,
        body: content.slice(0, 140),
        linkUrl: '/dashboard/messages',
      })),
    }).catch(() => {});
  }

  // Tiered SMS delivery of an owner reply. Basic: only to clients who texted the
  // business first (consent). Pro: also to clients who have a booking with the
  // business (proactive outreach). Best-effort — never blocks the in-app reply.
  async maybeSendReplySms(businessId: string, clientId: string, content: string, plan: 'BASIC' | 'PRO') {
    try {
      const client = await this.prisma.client.findFirst({ where: { id: clientId, businessId }, select: { phone: true } });
      const phone = normalizePhone(client?.phone);
      if (!phone) return { sent: false, reason: 'no_phone' };

      const textedFirst = await this.prisma.message.findFirst({
        where: { businessId, clientId, fromClient: true, channel: 'SMS' }, select: { id: true },
      });
      let eligible = !!textedFirst;
      if (!eligible && plan === 'PRO') {
        const booked = await this.prisma.appointment.findFirst({ where: { businessId, clientId }, select: { id: true } });
        eligible = !!booked;
      }
      if (!eligible) return { sent: false, reason: 'client_must_text_first' };

      const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
      await this.sms.send({ to: phone, body: `${biz?.name ? `${biz.name}: ` : ''}${content}` });
      return { sent: true };
    } catch (e) {
      this.logger.warn(`Reply SMS failed: ${e instanceof Error ? e.message : e}`);
      return { sent: false, reason: 'send_failed' };
    }
  }

  // Inbound SMS (Twilio webhook): a client texted the business's Pulse number.
  // Route by phone to the business with the most recent activity, store it as an
  // SMS message in that inbox (which also records consent to reply by text).
  async handleInboundSms(from: string, body: string) {
    const phone = normalizePhone(from);
    if (!phone || !body.trim()) return;
    const clients = await this.prisma.client.findMany({ where: { phone }, select: { id: true, businessId: true } });
    if (!clients.length) return;

    let target = clients[0];
    const businessIds = new Set(clients.map((client) => client.businessId));
    if (businessIds.size > 1) {
      this.logger.warn(`Inbound SMS from ${phone} matched multiple businesses; message was not routed.`);
      return;
    }
    if (clients.length > 1) {
      const ids = clients.map((c) => c.id);
      const recentMsg = await this.prisma.message.findFirst({ where: { clientId: { in: ids } }, orderBy: { createdAt: 'desc' }, select: { clientId: true } });
      const recentApt = recentMsg ? null : await this.prisma.appointment.findFirst({ where: { clientId: { in: ids } }, orderBy: { createdAt: 'desc' }, select: { clientId: true } });
      const pick = recentMsg?.clientId ?? recentApt?.clientId;
      target = clients.find((c) => c.id === pick) ?? target;
    }

    await this.send(target.businessId, target.id, body.slice(0, 2000), true, 'SMS');
  }

  async markRead(businessId: string, clientId: string, userId?: string) {
    const result = await this.prisma.message.updateMany({
      where: { businessId, clientId, fromClient: true, read: false },
      data: { read: true },
    });
    if (userId) {
      await this.prisma.messageThreadState.upsert({
        where: { businessId_clientId_userId: { businessId, clientId, userId } },
        create: { businessId, clientId, userId, lastReadAt: new Date() },
        update: { lastReadAt: new Date(), archivedAt: null },
      });
    }
    const unread = await this.getUnreadCount(businessId, userId);
    this.events.emitMessageUpdate(businessId, { clientId, ...unread });
    return { ...result, ...unread };
  }

  async getUnreadCount(businessId: string, userId?: string) {
    if (userId) {
      const [messages, states] = await Promise.all([
        this.prisma.message.findMany({
          where: { businessId, fromClient: true },
          select: { clientId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        }),
        this.prisma.messageThreadState.findMany({ where: { businessId, userId } }),
      ]);
      const stateByClient = new Map(states.map((state) => [state.clientId, state]));
      const unreadByClient = new Map<string, number>();
      for (const message of messages) {
        const state = stateByClient.get(message.clientId);
        if (state?.archivedAt) continue;
        if (!state?.lastReadAt || message.createdAt > state.lastReadAt) {
          unreadByClient.set(message.clientId, (unreadByClient.get(message.clientId) ?? 0) + 1);
        }
      }
      return {
        unreadMessages: Array.from(unreadByClient.values()).reduce((sum, count) => sum + count, 0),
        unreadThreads: unreadByClient.size,
      };
    }
    const [unreadMessages, unreadGroups] = await Promise.all([
      this.prisma.message.count({ where: { businessId, fromClient: true, read: false } }),
      this.prisma.message.groupBy({
        by: ['clientId'],
        where: { businessId, fromClient: true, read: false },
      }),
    ]);
    return { unreadMessages, unreadThreads: unreadGroups.length };
  }

  async getBusinessThreads(businessId: string, userId?: string, filters: { unreadOnly?: boolean; archived?: boolean; search?: string; channel?: string } = {}) {
    const states = userId
      ? await this.prisma.messageThreadState.findMany({ where: { businessId, userId } })
      : [];
    const stateByClient = new Map(states.map((state) => [state.clientId, state]));
    const [messages, unreadGroups] = await Promise.all([
      this.prisma.message.findMany({
        where: {
          businessId,
          ...(filters.channel ? { channel: filters.channel } : {}),
          ...(filters.search ? { OR: [
            { content: { contains: filters.search, mode: 'insensitive' } },
            { client: { name: { contains: filters.search, mode: 'insensitive' } } },
          ] } : {}),
        },
        include: { client: { select: { id: true, name: true, email: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        take: 2000, // bound: newest messages are enough to surface active threads
      }),
      this.prisma.message.groupBy({
        by: ['clientId'],
        where: { businessId, fromClient: true, read: false },
        _count: { _all: true },
      }),
    ]);
    const unreadByClient = new Map(unreadGroups.map((row) => [row.clientId, row._count._all]));

    // Group by clientId — return latest message per thread
    const threads = new Map<string, typeof messages[0]>();
    for (const m of messages) {
      if (!threads.has(m.clientId)) threads.set(m.clientId, m);
    }

    return Array.from(threads.values()).map((m) => {
      const state = stateByClient.get(m.clientId);
      const unreadCount = userId
        ? messages.filter((message) => message.clientId === m.clientId && message.fromClient && (!state?.lastReadAt || message.createdAt > state.lastReadAt)).length
        : unreadByClient.get(m.clientId) ?? 0;
      return ({
      clientId: m.clientId,
      client: m.client,
      lastMessage: m.content,
      fromClient: m.fromClient,
      read: unreadCount === 0,
      unreadCount,
      archived: Boolean(state?.archivedAt),
      createdAt: m.createdAt,
    });
    }).filter((thread) =>
      (filters.archived ? thread.archived : !thread.archived) &&
      (!filters.unreadOnly || thread.unreadCount > 0),
    );
  }

  async setArchived(businessId: string, clientId: string, userId: string, archived: boolean) {
    await this.prisma.client.findFirstOrThrow({ where: { id: clientId, businessId }, select: { id: true } });
    return this.prisma.messageThreadState.upsert({
      where: { businessId_clientId_userId: { businessId, clientId, userId } },
      create: { businessId, clientId, userId, archivedAt: archived ? new Date() : null },
      update: { archivedAt: archived ? new Date() : null },
    });
  }
}
