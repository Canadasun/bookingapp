import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationKind } from '@prisma/client';

interface NotifyInput {
  kind?: NotificationKind;
  title: string;
  body?: string;
  linkUrl?: string;
}

@Injectable()
export class InboxService {
  constructor(private prisma: PrismaService) {}

  notify(userId: string, data: NotifyInput) {
    return this.prisma.notification.create({
      data: { userId, kind: data.kind ?? 'SYSTEM', title: data.title, body: data.body, linkUrl: data.linkUrl },
    });
  }

  // Fan out to every owner of a business (e.g. a new booking).
  async notifyBusinessOwners(businessId: string, data: NotifyInput) {
    const owners = await this.prisma.user.findMany({ where: { businessId, role: 'OWNER' }, select: { id: true } });
    if (!owners.length) return;
    await this.prisma.notification.createMany({
      data: owners.map((o) => ({
        userId: o.id, kind: data.kind ?? 'SYSTEM', title: data.title, body: data.body ?? null, linkUrl: data.linkUrl ?? null,
      })),
    });
  }

  list(userId: string, limit = 30) {
    return this.prisma.notification.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: Math.min(limit, 100),
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  // Scoped to the user so one can't mark another user's notification read.
  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
    return { ok: true };
  }
}
