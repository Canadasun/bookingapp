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
  async setDue(businessId: string, dto: { clientId: string; serviceId?: string | null; policyId?: string | null; cadenceDays?: number | null; dueAt: string; messageSubject?: string | null; messageBody?: string | null }) {
    const client = await this.prisma.client.findFirst({ where: { id: dto.clientId, businessId }, select: { id: true } });
    if (!client) throw new NotFoundException('Client not found');
    if (dto.serviceId) {
      const svc = await this.prisma.service.findFirst({ where: { id: dto.serviceId, businessId }, select: { id: true } });
      if (!svc) throw new NotFoundException('Service not found');
    }
    const policy = dto.policyId
      ? await this.prisma.followUpPolicy.findFirst({ where: { id: dto.policyId, businessId, enabled: true } })
      : null;
    if (dto.policyId && !policy) throw new NotFoundException('Follow-up policy not found');
    await this.prisma.serviceDue.updateMany({
      where: {
        businessId,
        clientId: dto.clientId,
        serviceId: dto.serviceId || policy?.serviceId || null,
        policyId: dto.policyId || null,
        status: { not: 'CANCELLED' },
      },
      data: { status: 'CANCELLED' },
    });
    return this.prisma.serviceDue.create({
      data: {
        businessId,
        clientId: dto.clientId,
        serviceId: dto.serviceId || policy?.serviceId || null,
        policyId: policy?.id || null,
        cadenceDays: dto.cadenceDays ?? null,
        dueAt: new Date(dto.dueAt),
        messageSubject: dto.messageSubject ?? policy?.subject ?? null,
        messageBody: dto.messageBody ?? policy?.body ?? null,
        status: 'SCHEDULED',
      },
      include: dueInclude,
    });
  }

  listPolicies(businessId: string) {
    return this.prisma.followUpPolicy.findMany({ where: { businessId }, include: { service: true }, orderBy: { name: 'asc' } });
  }

  async createPolicy(businessId: string, dto: { serviceId?: string | null; name: string; trigger: string; delayDays: number; subject: string; body: string; enabled?: boolean }) {
    if (dto.serviceId) {
      const service = await this.prisma.service.findFirst({ where: { id: dto.serviceId, businessId }, select: { id: true } });
      if (!service) throw new NotFoundException('Service not found');
    }
    return this.prisma.followUpPolicy.create({ data: { businessId, ...dto, serviceId: dto.serviceId || null } });
  }

  async updatePolicy(businessId: string, id: string, dto: Partial<{ serviceId: string | null; name: string; trigger: string; delayDays: number; subject: string; body: string; enabled: boolean }>) {
    const policy = await this.prisma.followUpPolicy.findFirst({ where: { id, businessId }, select: { id: true } });
    if (!policy) throw new NotFoundException('Follow-up policy not found');
    return this.prisma.followUpPolicy.update({ where: { id, businessId }, data: dto });
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
    if (d.messageSubject || d.messageBody) await this.notifications.sendCustomFollowUp(d.id);
    else await this.notifications.sendRebookNudge(d.clientId);
    if (d.cadenceDays && d.cadenceDays > 0) {
      const base = d.dueAt > new Date() ? d.dueAt : new Date();
      const next = new Date(base.getTime() + d.cadenceDays * 86_400_000);
      return this.prisma.serviceDue.update({
        where: { id: d.id, businessId: d.businessId },
        data: { status: 'SCHEDULED', dueAt: next, lastNotifiedAt: new Date() },
        include: dueInclude,
      });
    }
    return this.prisma.serviceDue.update({
      where: { id: d.id, businessId: d.businessId },
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
      where: { id: d.id, businessId: d.businessId },
      data: { status: 'SCHEDULED', cadenceDays: dto.cadenceDays ?? d.cadenceDays, dueAt },
      include: dueInclude,
    });
  }

  async cancel(businessId: string, id: string) {
    const d = await this.prisma.serviceDue.findFirst({ where: { id, businessId }, select: { id: true } });
    if (!d) throw new NotFoundException('Follow-up not found');
    return this.prisma.serviceDue.update({ where: { id: d.id, businessId }, data: { status: 'CANCELLED' }, include: dueInclude });
  }

  async deletePolicy(businessId: string, id: string) {
    const policy = await this.prisma.followUpPolicy.findFirst({ where: { id, businessId }, select: { id: true } });
    if (!policy) throw new NotFoundException('Follow-up policy not found');
    await this.prisma.serviceDue.updateMany({ where: { policyId: id, businessId, status: { not: 'CANCELLED' } }, data: { status: 'CANCELLED', policyId: null } });
    return this.prisma.followUpPolicy.delete({ where: { id, businessId } });
  }
}
