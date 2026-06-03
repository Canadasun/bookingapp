import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
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

  send(businessId: string, clientId: string, content: string, fromClient: boolean) {
    return this.prisma.message.create({
      data: { businessId, clientId, content, fromClient },
    });
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
