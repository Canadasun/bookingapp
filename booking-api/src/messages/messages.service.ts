import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhone } from '../common/util/phone';
import { TwilioSmsProvider } from '../notifications/providers/sms.provider';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private readonly sms = new TwilioSmsProvider();

  constructor(private prisma: PrismaService) {}

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
    if (user.emailVerified && client.email.toLowerCase() === user.email.toLowerCase()) {
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
      await this.notifyBusinessUsersOfClientMessage(businessId, clientId, content, channel);
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
        title: `New ${source} from ${client?.name ?? 'a client'}`,
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
    if (clients.length > 1) {
      const ids = clients.map((c) => c.id);
      const recentMsg = await this.prisma.message.findFirst({ where: { clientId: { in: ids } }, orderBy: { createdAt: 'desc' }, select: { clientId: true } });
      const recentApt = recentMsg ? null : await this.prisma.appointment.findFirst({ where: { clientId: { in: ids } }, orderBy: { createdAt: 'desc' }, select: { clientId: true } });
      const pick = recentMsg?.clientId ?? recentApt?.clientId;
      target = clients.find((c) => c.id === pick) ?? target;
    }

    await this.send(target.businessId, target.id, body.slice(0, 2000), true, 'SMS');
  }

  markRead(businessId: string, clientId: string) {
    return this.prisma.message.updateMany({
      where: { businessId, clientId, fromClient: true, read: false },
      data: { read: true },
    });
  }

  async getBusinessThreads(businessId: string, unreadOnly = false) {
    const messages = await this.prisma.message.findMany({
      where: {
        businessId,
        ...(unreadOnly ? { fromClient: true, read: false } : {}),
      },
      include: { client: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 2000, // bound: newest messages are enough to surface active threads
    });

    // Group by clientId — return latest message per thread
    const threads = new Map<string, typeof messages[0]>();
    for (const m of messages) {
      if (!threads.has(m.clientId)) threads.set(m.clientId, m);
    }

    return Array.from(threads.values()).map((m) => ({
      clientId: m.clientId,
      client: m.client,
      lastMessage: m.content,
      fromClient: m.fromClient,
      read: m.read,
      createdAt: m.createdAt,
    }));
  }
}
