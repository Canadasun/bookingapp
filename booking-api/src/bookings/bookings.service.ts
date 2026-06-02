import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAppointmentDto, RescheduleDto, StatusDto } from './dto/appointment.dto';
import { Prisma } from '@prisma/client';
import { addMinutes } from 'date-fns';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findAll(
    businessId: string,
    page = 1,
    limit = 50,
    user?: { id: string; role: string },
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.AppointmentWhereInput = { businessId };

    // Role separation: STAFF only ever see their own appointments. OWNER/ADMIN
    // see all. Enforced server-side so it can't be bypassed by calling the API
    // directly (the web/mobile clients also filter, but that is cosmetic).
    if (user?.role === 'STAFF') {
      const staff = await this.prisma.staff.findFirst({
        where: { userId: user.id, businessId },
        select: { id: true },
      });
      // No staff record for this user → match nothing rather than leak.
      where.staffId = staff?.id ?? '__no_staff__';
    }
    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: { client: true, service: true, staff: { include: { user: true } }, business: true },
        orderBy: { startsAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string, businessId?: string) {
    const apt = await this.prisma.appointment.findFirst({
      where: { 
        id,
        ...(businessId ? { businessId } : {})
      },
      include: { client: true, service: true, staff: { include: { user: true } }, business: true },
    });
    if (!apt) throw new NotFoundException('Appointment not found');
    return apt;
  }

  /**
   * Creates an appointment with SERIALIZABLE isolation + SELECT FOR UPDATE
   * to guarantee exactly-once booking under concurrent requests.
   */
  async create(businessId: string, dto: CreateAppointmentDto, opts: { confirmed?: boolean } = {}) {
    const primaryService = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, businessId },
    });
    if (!primaryService) throw new NotFoundException('Service not found');

    // Sum durations of all selected services
    let totalDurationMinutes = primaryService.durationMinutes;
    const additionalServiceNames: string[] = [];
    if (dto.additionalServiceIds?.length) {
      const extras = await this.prisma.service.findMany({
        where: { id: { in: dto.additionalServiceIds }, businessId },
      });
      totalDurationMinutes += extras.reduce((sum, s) => sum + s.durationMinutes, 0);
      additionalServiceNames.push(...extras.map((s) => s.name));
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = addMinutes(startsAt, totalDurationMinutes);

    // Append additional service names to notes for display
    const notesWithServices = [
      dto.notes,
      additionalServiceNames.length
        ? `Also includes: ${additionalServiceNames.join(', ')}`
        : null,
    ]
      .filter(Boolean)
      .join(' | ') || undefined;

    const runBooking = () =>
      this.prisma.$transaction(
        async (tx) => {
          // Lock all overlapping appointments for this staff member.
          // This prevents concurrent transactions from inserting a conflicting row.
          await tx.$queryRaw(Prisma.sql`
            SELECT id FROM "Appointment"
            WHERE "staffId" = ${dto.staffId}
              AND "businessId" = ${businessId}
              AND status IN ('CONFIRMED', 'PENDING')
              AND "startsAt" < ${endsAt}
              AND "endsAt" > ${startsAt}
            FOR UPDATE
          `);

          // Re-check availability inside the transaction
          const conflict = await tx.appointment.findFirst({
            where: {
              businessId,
              staffId: dto.staffId,
              status: { in: ['CONFIRMED', 'PENDING'] },
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          });

          if (conflict) {
            throw new ConflictException('This time slot is no longer available');
          }

          return tx.appointment.create({
            data: {
              businessId,
              staffId: dto.staffId,
              serviceId: dto.serviceId,
              clientId: dto.clientId,
              startsAt,
              endsAt,
              notes: notesWithServices,
              // Owner/staff-initiated bookings skip the approval queue and are
              // confirmed immediately; public self-service stays PENDING.
              ...(opts.confirmed ? { status: 'CONFIRMED' as const } : {}),
            },
            include: { client: true, service: true, staff: { include: { user: true } }, business: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    // When two bookings race for the same slot, neither sees an existing row to
    // lock, so both proceed and Postgres aborts the loser at COMMIT with a
    // write-conflict (P2034). Retry: the next attempt's in-transaction re-check
    // sees the now-committed row and throws a clean 409 instead of a 500.
    let appointment: Awaited<ReturnType<typeof runBooking>>;
    for (let attempt = 0; ; attempt++) {
      try {
        appointment = await runBooking();
        break;
      } catch (err) {
        if (err instanceof ConflictException) throw err;
        const isWriteConflict =
          err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';
        if (isWriteConflict && attempt < 2) continue;
        if (isWriteConflict) {
          throw new ConflictException('This time slot is no longer available');
        }
        throw err;
      }
    }

    await this.logAction('APPOINTMENT', appointment.id, 'CREATE', {
      startsAt: appointment.startsAt,
      confirmed: !!opts.confirmed,
    });

    if (opts.confirmed) {
      // Owner/staff booking: confirm immediately, send the real confirmation to
      // the client and schedule reminders. No pending notice, no owner alert.
      await this.notifications.scheduleReminders(appointment);
    } else {
      // Public self-service: notify client it's PENDING approval; alert owner to act.
      await Promise.allSettled([
        this.notifications.sendPendingNotification(appointment),
        this.notifications.sendAdminBookingAlert(appointment.id),
      ]);
    }

    return appointment;
  }

  async confirm(id: string, businessId?: string) {
    const apt = await this.findOne(id, businessId);
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: { client: true, service: true, business: true },
    });
    await this.notifications.scheduleReminders(updated);
    return updated;
  }

  async reschedule(id: string, dto: RescheduleDto, businessId?: string) {
    const existing = await this.findOne(id, businessId);
    const service = await this.prisma.service.findFirstOrThrow({
      where: { id: existing.serviceId, businessId: existing.businessId },
    });

    const startsAt = new Date(dto.startsAt);
    const endsAt = addMinutes(startsAt, service.durationMinutes);

    const runReschedule = () =>
      this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw(Prisma.sql`
            SELECT id FROM "Appointment"
            WHERE "staffId" = ${existing.staffId}
              AND "businessId" = ${existing.businessId}
              AND status IN ('CONFIRMED', 'PENDING')
              AND id != ${id}
              AND "startsAt" < ${endsAt}
              AND "endsAt" > ${startsAt}
            FOR UPDATE
          `);

          const conflict = await tx.appointment.findFirst({
            where: {
              businessId: existing.businessId,
              staffId: existing.staffId,
              status: { in: ['CONFIRMED', 'PENDING'] },
              id: { not: id },
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          });

          if (conflict) throw new ConflictException('New time slot is not available');

          return tx.appointment.update({
            where: { id },
            data: { startsAt, endsAt, status: 'PENDING' },
            include: { client: true, service: true, business: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    // Same write-conflict (P2034) retry as create() — see note there.
    let updated: Awaited<ReturnType<typeof runReschedule>>;
    for (let attempt = 0; ; attempt++) {
      try {
        updated = await runReschedule();
        break;
      } catch (err) {
        if (err instanceof ConflictException) throw err;
        const isWriteConflict =
          err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';
        if (isWriteConflict && attempt < 2) continue;
        if (isWriteConflict) throw new ConflictException('New time slot is not available');
        throw err;
      }
    }

    await this.notifications.cancelReminders(id);
    await this.notifications.sendReschedule(updated);
    return updated;
  }

  async updateStatus(id: string, dto: StatusDto, businessId?: string, byStaff = false) {
    await this.findOne(id, businessId);
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.cancelReason ? { cancelReason: dto.cancelReason } : {}),
      },
      include: { client: true, service: true, business: true },
    });

    await this.logAction('APPOINTMENT', id, 'UPDATE_STATUS', { status: dto.status });

    if (dto.status === 'CANCELLED') {
      await this.notifications.cancelReminders(id);
      if (byStaff) {
        await this.notifications.sendStaffCancellation(updated);
      } else {
        await this.notifications.sendCancellation(updated);
      }
      await this.notifyWaitlist(updated.businessId, updated.serviceId);
    }

    if (dto.status === 'COMPLETED') {
      // Post-visit review request.
      const full = await this.findOne(id, businessId);
      await this.notifications.sendReviewRequest(full);
    }

    return updated;
  }

  // Auto-fill: when a slot opens (cancellation), notify the oldest waiting
  // waitlist entry that matches the freed service (or has no service preference).
  private async notifyWaitlist(businessId: string, serviceId: string) {
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: {
        businessId,
        status: 'WAITING',
        OR: [{ serviceId: null }, { serviceId }],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!entry) return;
    await this.prisma.waitlistEntry.update({ where: { id: entry.id }, data: { status: 'NOTIFIED' } });
    await this.notifications.notifyWaitlistOpening(entry.id);
  }

  private async logAction(entityType: string, entityId: string, action: string, changes?: any, userId?: string) {
    try {
      await this.prisma.auditLog.create({
        data: { entityType, entityId, action, changes, userId },
      });
    } catch (e) {
      console.error('[AuditLog Error]', e);
    }
  }
}
