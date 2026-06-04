import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { EventsGateway } from '../events/events.gateway';
import { AvailabilityService } from '../availability/availability.service';
import { GoogleCalendarService } from '../calendar-sync/google-calendar.service';
import { CreateAppointmentDto, RescheduleDto, StatusDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { signAppointmentToken } from '../common/util/appointment-token';
import { normalizePhone } from '../common/util/phone';
import { isPaidPlan } from '../common/util/plan-features';
import { Prisma } from '@prisma/client';
import { addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private payments: PaymentsService,
    private events: EventsGateway,
    private availability: AvailabilityService,
    private googleCalendar: GoogleCalendarService,
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

  // A business with one active provider (sole proprietor) doesn't require
  // per-service staff assignment — the lone provider offers everything.
  private async hasMultipleStaff(businessId: string): Promise<boolean> {
    return (await this.prisma.staff.count({ where: { businessId, active: true } })) > 1;
  }

  /**
   * Creates an appointment with SERIALIZABLE isolation + SELECT FOR UPDATE
   * to guarantee exactly-once booking under concurrent requests.
   */
  async create(businessId: string, dto: CreateAppointmentDto, opts: { confirmed?: boolean; overrideConflicts?: boolean } = {}) {
    const primaryService = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, businessId },
    });
    if (!primaryService) throw new NotFoundException('Service not found');
    if (primaryService.active === false) throw new BadRequestException('Service is not available');

    // Tenant integrity: the staff and client must belong to THIS business, the
    // staff must be active, and actually offer the selected service. Otherwise a
    // crafted request could attach another business's staff/client to a booking.
    const staff = await this.prisma.staff.findFirst({ where: { id: dto.staffId, businessId, active: true } });
    if (!staff) throw new NotFoundException('Staff not found');
    const client = await this.prisma.client.findFirst({ where: { id: dto.clientId, businessId } });
    if (!client) throw new NotFoundException('Client not found');
    const offersService = await this.prisma.staffService.findFirst({ where: { staffId: dto.staffId, serviceId: dto.serviceId } });
    // Owner override (manual custom-time booking) can assign any active staff to
    // the service. Single-provider (sole-proprietor) businesses also skip this —
    // the lone provider offers every service without explicit assignment.
    if (!offersService && !opts.overrideConflicts && (await this.hasMultipleStaff(businessId))) {
      throw new BadRequestException('This staff member does not offer the selected service');
    }

    // Sum durations of all selected services
    let totalDurationMinutes = primaryService.durationMinutes;
    const additionalServiceNames: string[] = [];
    if (dto.additionalServiceIds?.length) {
      const ids = [...new Set(dto.additionalServiceIds)];
      const extras = await this.prisma.service.findMany({
        where: { id: { in: ids }, businessId, active: true },
      });
      if (extras.length !== ids.length) {
        throw new BadRequestException('One or more selected services are unavailable');
      }
      // Every additional service must also be offered by the chosen staff member.
      const offered = await this.prisma.staffService.count({
        where: { staffId: dto.staffId, serviceId: { in: ids } },
      });
      if (offered !== ids.length && !opts.overrideConflicts && (await this.hasMultipleStaff(businessId))) {
        throw new BadRequestException('This staff member does not offer one of the selected services');
      }
      totalDurationMinutes += extras.reduce((sum, s) => sum + s.durationMinutes, 0);
      additionalServiceNames.push(...extras.map((s) => s.name));
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = addMinutes(startsAt, totalDurationMinutes);

    // Booking-window policy. Owner/staff bookings (opts.confirmed) can override;
    // public self-service must respect the business's notice + advance limits.
    if (!opts.confirmed) {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        select: { minNoticeMinutes: true, maxAdvanceDays: true, timezone: true },
      });
      const now = Date.now();
      const minNoticeMs = (business?.minNoticeMinutes ?? 0) * 60_000;
      const maxAdvanceMs = (business?.maxAdvanceDays ?? 365) * 24 * 60 * 60_000;
      if (startsAt.getTime() < now + minNoticeMs) {
        throw new BadRequestException('This time is too soon — please pick a later slot.');
      }
      if (startsAt.getTime() > now + maxAdvanceMs) {
        throw new BadRequestException('This time is too far in advance.');
      }
      await this.assertStartsAtAvailable(dto.staffId, dto.serviceId, startsAt, endsAt, business?.timezone ?? 'UTC');
    }

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
          if (!opts.overrideConflicts) {
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
      overrideConflicts: !!opts.overrideConflicts,
    });

    this.events.emitBookingUpdate(businessId, {
      type: 'CREATE',
      appointmentId: appointment.id,
      status: appointment.status,
    });

    if (opts.confirmed) {
      // Owner/staff booking: confirm immediately, send the real confirmation to
      // the client and schedule reminders. No pending notice, no owner alert.
      await this.notifications.scheduleReminders(appointment);
      void this.googleCalendar.syncAppointment(appointment.id); // best-effort, fire-and-forget
    } else {
      // Public self-service: notify client it's PENDING approval; alert owner to act.
      await Promise.allSettled([
        this.notifications.sendPendingNotification(appointment),
        this.notifications.sendAdminBookingAlert(appointment.id),
      ]);
      void this.googleCalendar.syncAppointment(appointment.id); // keep connected calendars blocked even while pending
    }

    // Manage token so the confirmation screen can link straight to the manage page.
    return { ...appointment, manageToken: signAppointmentToken(appointment.id) };
  }

  async confirm(id: string, businessId?: string, userId?: string) {
    const apt = await this.findOne(id, businessId);
    if (isPaidPlan(apt.business.plan) && apt.business.requireDeposit && apt.status === 'PENDING') {
      const paidDeposit = await this.prisma.payment.findFirst({
        where: {
          appointmentId: id,
          businessId: apt.businessId,
          kind: 'DEPOSIT',
          status: 'SUCCEEDED',
        },
      });
      if (!paidDeposit) {
        throw new BadRequestException('This booking requires a paid deposit before it can be confirmed.');
      }
    }
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: { client: true, service: true, business: true },
    });
    await this.logAction('APPOINTMENT', id, 'UPDATE_STATUS', {
      fromStatus: apt.status,
      status: 'CONFIRMED',
    }, userId);

    this.events.emitBookingUpdate(updated.businessId, {
      type: 'UPDATE_STATUS',
      appointmentId: id,
      status: 'CONFIRMED',
    });

    await this.notifications.scheduleReminders(updated);
    void this.googleCalendar.syncAppointment(updated.id); // push to Google Calendar
    return updated;
  }

  async reschedule(
    id: string,
    dto: RescheduleDto,
    businessId?: string,
    opts: { byClient?: boolean; userId?: string } = {},
  ) {
    const existing = await this.findOne(id, businessId);
    const service = await this.prisma.service.findFirstOrThrow({
      where: { id: existing.serviceId, businessId: existing.businessId },
    });
    if (service.active === false) throw new BadRequestException('Service is not available');

    const startsAt = new Date(dto.startsAt);
    const endsAt = addMinutes(startsAt, service.durationMinutes);

    // Re-apply the same integrity + policy checks as creation — a reschedule must
    // not slip a booking into a state the business wouldn't otherwise allow.
    const biz = existing.business;
    const staff = await this.prisma.staff.findFirst({
      where: { id: existing.staffId, businessId: existing.businessId, active: true },
    });
    if (!staff) throw new BadRequestException('This staff member is no longer available');
    const offersService = await this.prisma.staffService.findFirst({
      where: { staffId: existing.staffId, serviceId: existing.serviceId },
    });
    if (!offersService) throw new BadRequestException('This staff member no longer offers the service');

    if (opts.byClient) {
      if (biz && !biz.allowClientReschedule) {
        throw new ForbiddenException('Online rescheduling is disabled — please contact the business.');
      }
      const now = Date.now();
      const minNoticeMs = (biz?.minNoticeMinutes ?? 0) * 60_000;
      const maxAdvanceMs = (biz?.maxAdvanceDays ?? 365) * 24 * 60 * 60_000;
      if (startsAt.getTime() < now + minNoticeMs) throw new BadRequestException('This time is too soon — please pick a later slot.');
      if (startsAt.getTime() > now + maxAdvanceMs) throw new BadRequestException('This time is too far in advance.');
      await this.assertStartsAtAvailable(existing.staffId, existing.serviceId, startsAt, endsAt, biz?.timezone ?? 'UTC');
    }

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
            // A client-initiated reschedule goes back to PENDING for re-approval.
            // An owner/staff reschedule keeps the current status (a CONFIRMED
            // booking stays CONFIRMED) — moving a time shouldn't un-confirm it.
            data: { startsAt, endsAt, ...(opts.byClient ? { status: 'PENDING' as const } : {}) },
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
    // Re-arm reminders against the new time when the booking remains CONFIRMED
    // (owner reschedule). Client reschedules drop to PENDING and get reminders
    // when the owner re-confirms, so we don't double-schedule here.
    if (updated.status === 'CONFIRMED') await this.notifications.scheduleReminders(updated);
    void this.googleCalendar.syncAppointment(id); // update the Google event time
    await this.logAction('APPOINTMENT', id, 'RESCHEDULE', {
      fromStartsAt: existing.startsAt,
      toStartsAt: startsAt,
      fromStatus: existing.status,
      status: 'PENDING',
      byClient: !!opts.byClient,
    }, opts.userId);

    this.events.emitBookingUpdate(updated.businessId, {
      type: 'RESCHEDULE',
      appointmentId: id,
      status: 'PENDING',
    });

    return updated;
  }

  async updateStatus(id: string, dto: StatusDto, businessId?: string, byStaff = false, userId?: string) {
    const existing = await this.findOne(id, businessId);
    if (dto.status === 'CANCELLED' && !['PENDING', 'CONFIRMED'].includes(existing.status)) {
      throw new BadRequestException('Only pending or confirmed appointments can be cancelled');
    }

    // Strict cancellation-window enforcement. A client (byStaff=false) may only
    // self-cancel BEFORE the business's cancellation window. Once inside it, the
    // online cancel is refused — the client is told to contact the business, and
    // the owner is notified to decide whether to cancel and/or charge. Owners and
    // staff (byStaff=true) can always cancel.
    if (dto.status === 'CANCELLED' && !byStaff) {
      const biz = existing.business;
      const cutoff = biz && new Date(existing.startsAt.getTime() - biz.cancellationWindowHours * 3600 * 1000);
      if (cutoff && new Date() > cutoff) {
        await this.notifications.sendLateCancellationRequest(existing).catch(() => {});
        throw new ForbiddenException({
          code: 'TOO_LATE_TO_CANCEL',
          message: `It's past the ${biz!.cancellationWindowHours}-hour cancellation window. Please contact ${biz!.name} to cancel — we've let them know you'd like to.`,
        });
      }
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.cancelReason ? { cancelReason: dto.cancelReason } : {}),
      },
      include: { client: true, service: true, business: true },
    });

    let cancelFee: { charged: boolean; feeCents: number; reason?: string } | undefined;
    const auditChanges: Record<string, unknown> = {
      fromStatus: existing.status,
      status: dto.status,
    };

    if (dto.status === 'CANCELLED') {
      await this.notifications.cancelReminders(id);
      void this.googleCalendar.removeAppointment(id); // remove the Google event

      // Late-cancellation fee. PAID plans only; client-initiated cancels only
      // (byStaff=false — an owner/staff cancel never charges the client). It's a
      // "late" cancel when we're already inside the cancellation window. Free tier
      // and early cancels are always free. Best-effort: never blocks the cancel.
      const biz = updated.business;
      const cancellationTiming =
        biz && new Date() > new Date(updated.startsAt.getTime() - biz.cancellationWindowHours * 3600 * 1000)
          ? 'late'
          : 'early';
      auditChanges.cancelReason = dto.cancelReason ?? null;
      auditChanges.cancelledBy = byStaff ? 'staff' : 'client';
      auditChanges.cancellationTiming = cancellationTiming;
      auditChanges.cancellationWindowHours = biz?.cancellationWindowHours ?? null;

      // Cancellation fee: charged only when the owner/staff explicitly opts in
      // while cancelling (e.g. enforcing the policy after a client cancelled late
      // — late client self-cancels are blocked above, so the owner does it). The
      // payments service owns eligibility (Pro + a configured fee + a card on
      // file) and is best-effort: it never throws, so the cancel always succeeds.
      // A client self-cancel never charges.
      if (byStaff && dto.chargeCancellationFee) {
        cancelFee = await this.payments.chargeCancellationFee(id, updated.businessId);
        auditChanges.cancelFee = cancelFee;
      }

      if (byStaff) {
        await this.notifications.sendStaffCancellation(updated);
      } else {
        await this.notifications.sendCancellation(updated);
      }
      await this.notifyWaitlist(updated.businessId, updated.serviceId);
    }

    await this.logAction('APPOINTMENT', id, 'UPDATE_STATUS', auditChanges, userId);

    this.events.emitBookingUpdate(updated.businessId, {
      type: 'UPDATE_STATUS',
      appointmentId: id,
      status: dto.status,
    });

    if (dto.status === 'COMPLETED') {
      // Post-visit review request.
      const full = await this.findOne(id, businessId);
      await this.notifications.sendReviewRequest(full);
    }

    return { ...updated, cancelFee };
  }

  async requestLateCancellation(id: string, cancelReason?: string) {
    const existing = await this.findOne(id);
    if (!['PENDING', 'CONFIRMED'].includes(existing.status)) {
      throw new BadRequestException('Only pending or confirmed appointments can request cancellation');
    }
    const cutoff = new Date(existing.startsAt.getTime() - existing.business.cancellationWindowHours * 3600 * 1000);
    if (new Date() <= cutoff) {
      throw new BadRequestException('This appointment is still outside the cancellation window and can be cancelled online.');
    }

    await this.notifications.sendLateCancellationRequest({
      ...existing,
      ...(cancelReason ? { cancelReason } : {}),
    }).catch(() => {});

    await this.logAction('APPOINTMENT', id, 'LATE_CANCEL_REQUEST', {
      status: existing.status,
      cancelReason: cancelReason ?? null,
      cancellationWindowHours: existing.business.cancellationWindowHours,
    });

    return {
      ok: true,
      code: 'LATE_CANCEL_REQUESTED',
      message: `It's past the ${existing.business.cancellationWindowHours}-hour cancellation window. Please contact ${existing.business.name} to cancel — we've let them know you'd like to.`,
    };
  }

  async updateDetails(id: string, dto: UpdateAppointmentDto, businessId: string, userId?: string) {
    const existing = await this.findOne(id, businessId);
    let startsAt = existing.startsAt;
    let endsAt = existing.endsAt;
    let timeChanged = false;

    if (dto.startsAt) {
      const service = await this.prisma.service.findFirstOrThrow({
        where: { id: existing.serviceId, businessId: existing.businessId },
      });
      startsAt = new Date(dto.startsAt);
      endsAt = addMinutes(startsAt, service.durationMinutes);
      timeChanged = startsAt.getTime() !== existing.startsAt.getTime();

      const conflict = await this.prisma.appointment.findFirst({
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
    }

    const normalizedClientPhone =
      dto.clientPhone !== undefined && dto.clientPhone
        ? normalizePhone(dto.clientPhone)
        : undefined;
    if (dto.clientPhone && !normalizedClientPhone) {
      throw new BadRequestException('Enter a valid phone number, e.g. +1 555 123 4567');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        ...(dto.startsAt ? { startsAt, endsAt } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
        ...(dto.clientName || dto.clientEmail || dto.clientPhone !== undefined
          ? {
              client: {
                update: {
                  ...(dto.clientName ? { name: dto.clientName } : {}),
                  ...(dto.clientEmail ? { email: dto.clientEmail } : {}),
                  ...(dto.clientPhone !== undefined ? { phone: normalizedClientPhone ?? null } : {}),
                },
              },
            }
          : {}),
      },
      include: { client: true, service: true, staff: { include: { user: true } }, business: true },
    });

    if (timeChanged) await this.notifications.cancelReminders(id);
    if (dto.notifyClient) {
      if (timeChanged) await this.notifications.sendReschedule(updated);
      else await this.notifications.sendConfirmation(updated);
    }

    await this.logAction('APPOINTMENT', id, 'UPDATE_DETAILS', {
      fromStartsAt: existing.startsAt,
      toStartsAt: startsAt,
      clientUpdated: !!(dto.clientName || dto.clientEmail || dto.clientPhone !== undefined),
      notesUpdated: dto.notes !== undefined,
      notifiedClient: !!dto.notifyClient,
    }, userId);

    this.events.emitBookingUpdate(updated.businessId, {
      type: 'UPDATE_DETAILS',
      appointmentId: id,
      status: updated.status,
    });

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

  private async assertStartsAtAvailable(staffId: string, serviceId: string, startsAt: Date, endsAt: Date, timezone: string) {
    const day = formatInTimeZone(startsAt, timezone, 'yyyy-MM-dd');
    const slots = await this.availability.getAvailableSlots({
      staffId,
      serviceId,
      startDate: day,
      endDate: day,
      timezone,
    });
    if (!slots.some((slot) => slot.startsAt.getTime() === startsAt.getTime())) {
      throw new BadRequestException('This time is outside the business availability. Please choose another slot.');
    }
    const localStartDay = formatInTimeZone(startsAt, timezone, 'yyyy-MM-dd');
    const localEndDay = formatInTimeZone(endsAt, timezone, 'yyyy-MM-dd');
    if (localStartDay !== localEndDay) {
      throw new BadRequestException('This appointment must fit within one business day.');
    }

    const dayOfWeek = Number(formatInTimeZone(startsAt, timezone, 'i')) % 7;
    const localStart = formatInTimeZone(startsAt, timezone, 'HH:mm');
    const localEnd = formatInTimeZone(endsAt, timezone, 'HH:mm');
    const rules = await this.prisma.availabilityRule.findMany({ where: { staffId, dayOfWeek } });
    const effectiveRules = rules.length ? rules : [{ startTime: '09:00', endTime: '17:00' }];
    const fitsRule = effectiveRules.some((rule) => localStart >= rule.startTime && localEnd <= rule.endTime);
    if (!fitsRule) {
      throw new BadRequestException('This appointment is longer than the available calendar window.');
    }

    const timeOff = await this.prisma.timeOff.findFirst({
      where: { staffId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    });
    if (timeOff) {
      throw new BadRequestException('This time overlaps staff time off.');
    }
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
