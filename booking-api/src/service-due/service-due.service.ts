import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const dueInclude = {
  client: { select: { id: true, name: true, email: true } },
  service: { select: { id: true, name: true } },
};

@Injectable()
export class ServiceDueService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  // Owner sets/updates a client's next-due. Replaces any existing active tracker
  // for that client (one active recurring due per client keeps it simple).
  async setDue(businessId: string, dto: { clientId: string; serviceId?: string | null; cadenceDays?: number | null; dueAt: string }) {
    const client = await this.prisma.client.findFirst({ where: { id: dto.clientId, businessId }, select: { id: true } });
    if (!client) throw new NotFoundException('Client not found');
    if (dto.serviceId) {
      const svc = await this.prisma.service.findFirst({ where: { id: dto.serviceId, businessId }, select: { id: true } });
      if (!svc) throw new NotFoundException('Service not found');
    }
    await this.prisma.serviceDue.updateMany({
      where: { businessId, clientId: dto.clientId, status: { not: 'CANCELLED' } },
      data: { status: 'CANCELLED' },
    });
    return this.prisma.serviceDue.create({
      data: {
        businessId,
        clientId: dto.clientId,
        serviceId: dto.serviceId || null,
        cadenceDays: dto.cadenceDays ?? null,
        dueAt: new Date(dto.dueAt),
        status: 'SCHEDULED',
      },
      include: dueInclude,
    });
  }

  list(businessId: string) {
    return this.prisma.serviceDue.findMany({
      where: { businessId, status: { in: ['SCHEDULED', 'DUE'] } },
      include: dueInclude,
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }], // DUE before SCHEDULED, soonest first
    });
  }

  // Owner approves the prompt: nudge the client to rebook and, if there's a
  // cadence, auto-advance the next due date; otherwise close the one-off tracker.
  async approve(businessId: string, id: string) {
    const d = await this.prisma.serviceDue.findFirst({ where: { id, businessId } });
    if (!d) throw new NotFoundException('Follow-up not found');
    await this.notifications.sendRebookNudge(d.clientId);
    if (d.cadenceDays && d.cadenceDays > 0) {
      const base = d.dueAt > new Date() ? d.dueAt : new Date();
      const next = new Date(base.getTime() + d.cadenceDays * 86_400_000);
      return this.prisma.serviceDue.update({
        where: { id },
        data: { status: 'SCHEDULED', dueAt: next, lastNotifiedAt: new Date() },
        include: dueInclude,
      });
    }
    return this.prisma.serviceDue.update({
      where: { id },
      data: { status: 'CANCELLED', lastNotifiedAt: new Date() },
      include: dueInclude,
    });
  }

  // Owner declines/reschedules: set a new cadence and/or date (e.g. client was away).
  async reschedule(businessId: string, id: string, dto: { cadenceDays?: number | null; dueAt?: string }) {
    const d = await this.prisma.serviceDue.findFirst({ where: { id, businessId } });
    if (!d) throw new NotFoundException('Follow-up not found');
    const dueAt = dto.dueAt
      ? new Date(dto.dueAt)
      : dto.cadenceDays
        ? new Date(Date.now() + dto.cadenceDays * 86_400_000)
        : d.dueAt;
    return this.prisma.serviceDue.update({
      where: { id },
      data: { status: 'SCHEDULED', cadenceDays: dto.cadenceDays ?? d.cadenceDays, dueAt },
      include: dueInclude,
    });
  }

  async cancel(businessId: string, id: string) {
    const d = await this.prisma.serviceDue.findFirst({ where: { id, businessId }, select: { id: true } });
    if (!d) throw new NotFoundException('Follow-up not found');
    return this.prisma.serviceDue.update({ where: { id }, data: { status: 'CANCELLED' }, include: dueInclude });
  }
}
