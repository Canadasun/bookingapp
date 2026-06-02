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
