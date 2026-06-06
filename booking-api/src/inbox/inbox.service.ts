import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryChannel, NotificationKind, NotificationStatus, Prisma, User } from '@prisma/client';

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

  deliveryLogs(
    user: User,
    filters: { limit?: number; status?: string; channel?: string; search?: string } = {},
  ) {
    if (user.role !== 'ADMIN' && !user.businessId) return [];
    const limit = Number.isFinite(filters.limit) ? Math.min(Math.max(filters.limit ?? 50, 1), 100) : 50;
    const where: Prisma.NotificationDeliveryWhereInput =
      user.role === 'ADMIN' ? {} : { businessId: user.businessId };

    if (filters.status && Object.values(NotificationStatus).includes(filters.status as NotificationStatus)) {
      where.status = filters.status as NotificationStatus;
    }
    if (filters.channel && Object.values(DeliveryChannel).includes(filters.channel as DeliveryChannel)) {
      where.channel = filters.channel as DeliveryChannel;
    }
    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { recipient: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } },
        { error: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.notificationDelivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }).then((rows) => rows.map((row) => ({
      ...row,
      canRetry: false,
      retryReason: row.status === 'FAILED' ? 'Original delivery payload is not stored; resend from the source workflow.' : null,
    })));
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

  async clear(userId: string) {
    await this.prisma.notification.deleteMany({ where: { userId } });
    return { ok: true };
  }
}
