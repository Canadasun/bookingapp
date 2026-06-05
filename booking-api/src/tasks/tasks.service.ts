import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type AuthUser = { id: string; role: string };
const taskInclude = { staff: { include: { user: { select: { name: true } } } } };

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  // Least privilege: owners/admins see every task; a staff member sees only the
  // tasks assigned to them.
  async list(businessId: string, user: AuthUser) {
    const where: { businessId: string; staffId?: string } = { businessId };
    if (user.role === 'STAFF') {
      const staff = await this.prisma.staff.findFirst({ where: { userId: user.id, businessId }, select: { id: true } });
      where.staffId = staff?.id ?? '__none__';
    }
    return this.prisma.staffTask.findMany({
      where,
      include: taskInclude,
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  private async assertStaffInBusiness(businessId: string, staffId?: string | null) {
    if (!staffId) return;
    const ok = await this.prisma.staff.findFirst({ where: { id: staffId, businessId }, select: { id: true } });
    if (!ok) throw new NotFoundException('That staff member is not in this business');
  }

  // Owner-only: create + assign a task.
  async create(businessId: string, dto: { title: string; staffId?: string | null; notes?: string; dueAt?: string }) {
    await this.assertStaffInBusiness(businessId, dto.staffId);
    return this.prisma.staffTask.create({
      data: {
        businessId,
        title: dto.title.trim(),
        staffId: dto.staffId || null,
        notes: dto.notes?.trim() || null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      },
      include: taskInclude,
    });
  }

  async update(
    businessId: string,
    id: string,
    user: AuthUser,
    dto: { title?: string; staffId?: string | null; notes?: string; dueAt?: string | null; status?: 'OPEN' | 'DONE' },
  ) {
    const task = await this.prisma.staffTask.findFirst({ where: { id, businessId } });
    if (!task) throw new NotFoundException('Task not found');

    // Staff may only mark their OWN task done/undone — nothing else.
    if (user.role === 'STAFF') {
      const staff = await this.prisma.staff.findFirst({ where: { userId: user.id, businessId }, select: { id: true } });
      if (task.staffId !== staff?.id) throw new ForbiddenException('This task is not assigned to you');
      const done = dto.status === 'DONE';
      return this.prisma.staffTask.update({
        where: { id },
        data: { status: done ? 'DONE' : 'OPEN', completedAt: done ? new Date() : null },
        include: taskInclude,
      });
    }

    // Owner/admin: full edit.
    if (dto.staffId !== undefined) await this.assertStaffInBusiness(businessId, dto.staffId);
    const done = dto.status === 'DONE';
    return this.prisma.staffTask.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.staffId !== undefined ? { staffId: dto.staffId || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.dueAt !== undefined ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null } : {}),
        ...(dto.status !== undefined ? { status: dto.status, completedAt: done ? new Date() : null } : {}),
      },
      include: taskInclude,
    });
  }

  // Owner-only.
  async remove(businessId: string, id: string) {
    const task = await this.prisma.staffTask.findFirst({ where: { id, businessId }, select: { id: true } });
    if (!task) throw new NotFoundException('Task not found');
    await this.prisma.staffTask.delete({ where: { id } });
    return { ok: true };
  }
}
