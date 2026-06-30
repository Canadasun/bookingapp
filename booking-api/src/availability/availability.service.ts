import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from '../calendar-sync/google-calendar.service';
import { GetSlotsDto, TimeSlot } from './dto/availability.dto';
import {
  addDays,
  addMinutes,
  isBefore,
  isEqual,
  parseISO,
  format,
  getDay,
} from 'date-fns';
import { fromZonedTime, toZonedTime, format as formatTZ } from 'date-fns-tz';
import { AvailabilityRule, TimeOff, Appointment } from '@prisma/client';

type AppointmentWithServiceBuffers = Appointment & {
  service?: { bufferBeforeMin: number; bufferAfterMin: number } | null;
};

interface Interval {
  start: Date;
  end: Date;
}

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService, private google: GoogleCalendarService) {}

  async getAvailableSlots(dto: GetSlotsDto): Promise<TimeSlot[]> {
    const { staffId, serviceId, startDate, endDate, timezone } = dto;

    const [primaryService, staff] = await Promise.all([
      this.prisma.service.findUnique({ where: { id: serviceId } }),
      this.prisma.staff.findUnique({
        where: { id: staffId },
        include: { business: true, user: { select: { role: true } }, location: { select: { timezone: true } } },
      }),
    ]);

    if (!primaryService) throw new NotFoundException('Service not found');
    if (!staff) throw new NotFoundException('Staff not found');
    // Staff and service must belong to the same business, the staff must be
    // active, and actually offer this service — otherwise the returned slots
    // are meaningless (and could mix tenants).
    if (staff.businessId !== primaryService.businessId) {
      throw new NotFoundException('Staff does not belong to this service’s business');
    }
    if (!staff.active) throw new NotFoundException('Staff is not available');
    const additionalIds = [...new Set(dto.additionalServiceIds ?? [])];
    const additionalServices = additionalIds.length
      ? await this.prisma.service.findMany({
          where: { id: { in: additionalIds }, businessId: primaryService.businessId, active: true },
        })
      : [];
    if (additionalServices.length !== additionalIds.length) {
      throw new NotFoundException('One or more additional services were not found');
    }
    const selectedServices = [primaryService, ...additionalServices];
    const service = {
      ...primaryService,
      durationMinutes: selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0),
      bufferBeforeMin: Math.max(...selectedServices.map((s) => s.bufferBeforeMin ?? 0)),
      bufferAfterMin: Math.max(...selectedServices.map((s) => s.bufferAfterMin ?? 0)),
    };
    const resourceIds = [...new Set(selectedServices.map((s) => s.resourceId).filter((id): id is string => !!id))];

    const assignedServiceCount = await this.prisma.staffService.count({ where: { staffId } });
    if (assignedServiceCount > 0) {
      const offered = await this.prisma.staffService.count({
        where: { staffId, serviceId: { in: selectedServices.map((s) => s.id) } },
      });
      if (offered !== selectedServices.length) throw new NotFoundException('Staff does not offer this service');
    }

    // Location timezone takes precedence over business timezone so that
    // providers at different branches have their schedule windows interpreted
    // in the correct local time (e.g. a Vancouver location open 9–5 should
    // generate slots anchored to America/Vancouver, not the business HQ).
    const businessTimezone = staff.location?.timezone ?? staff.business.timezone;

    // Parse dates in the requested timezone
    const rangeStart = fromZonedTime(`${startDate}T00:00:00`, timezone);
    const rangeEnd = fromZonedTime(`${endDate}T23:59:59`, timezone);
    const conflictRangeStart = addMinutes(rangeStart, -480);
    const conflictRangeEnd = addMinutes(rangeEnd, 480);

    const businessId = staff.businessId;

    const [rules, appointments, timeOffs, bizHours, bizClosures] = await Promise.all([
      this.prisma.availabilityRule.findMany({ where: { staffId } }),
      this.prisma.appointment.findMany({
        where: {
          staffId,
          status: { in: ['CONFIRMED', 'PENDING'] },
          startsAt: { lt: conflictRangeEnd },
          endsAt: { gt: conflictRangeStart },
        },
        include: { service: { select: { bufferBeforeMin: true, bufferAfterMin: true } } },
      }),
      this.prisma.timeOff.findMany({
        where: {
          staffId,
          startsAt: { lt: rangeEnd },
          endsAt: { gt: rangeStart },
        },
      }),
      // Business-level hours — used as fallback when staff has no custom rules.
      (this.prisma.businessHours as any).findMany({
        where: {
          businessId,
          ...(staff.locationId ? { OR: [{ locationId: staff.locationId }, { locationId: null }] } : { locationId: null }),
        },
      }),
      // Business closures (holidays/vacation) block slots for everyone.
      (this.prisma.businessClosure as any).findMany({
        where: {
          businessId,
          ...(staff.locationId ? { OR: [{ locationId: staff.locationId }, { locationId: null }] } : { locationId: null }),
          startsAt: { lt: rangeEnd },
          endsAt: { gt: rangeStart },
        },
      }),
    ]);

    // If this service occupies a shared resource (room/equipment), that resource
    // being used by ANOTHER staff member's appointment also blocks the slot. (Same
    // staff is already covered by `appointments`.) Treat those like time off.
    let effectiveTimeOffs = timeOffs;
    if (resourceIds.length) {
      const resourceBusy = await this.prisma.appointment.findMany({
        where: {
          businessId: primaryService.businessId,
          staffId: { not: staffId },
          status: { in: ['CONFIRMED', 'PENDING'] },
          startsAt: { lt: conflictRangeEnd },
          endsAt: { gt: conflictRangeStart },
          service: { resourceId: { in: resourceIds } },
        },
        select: { startsAt: true, endsAt: true, service: { select: { bufferBeforeMin: true, bufferAfterMin: true } } },
      });
      effectiveTimeOffs = [
        ...timeOffs,
        ...resourceBusy.map((a) => ({
          id: 'resource',
          staffId,
          reason: null,
          createdAt: a.startsAt,
          startsAt: addMinutes(a.startsAt, -(a.service?.bufferBeforeMin ?? 0)),
          endsAt: addMinutes(a.endsAt, a.service?.bufferAfterMin ?? 0),
        } as TimeOff)),
      ];
    }

    // Business closures block all booking slots regardless of individual schedule.
    effectiveTimeOffs = [
      ...effectiveTimeOffs,
      ...bizClosures.map((c: { id: string; reason: string | null; createdAt: Date; startsAt: Date; endsAt: Date }) => ({ id: `closure-${c.id}`, staffId, reason: c.reason ?? null, createdAt: c.createdAt, startsAt: c.startsAt, endsAt: c.endsAt } as TimeOff)),
    ];

    // Rule priority: staff-specific rules > business hours > hardcoded 9-5 default.
    // This lets a sole proprietor set business hours once; when they hire staff,
    // each provider can override with their own schedule without touching the default.
    const typedBizHours = bizHours as Array<{
      id: string; locationId: string | null; dayOfWeek: number; startTime: string; endTime: string;
    }>;
    const branchHours = staff.locationId && typedBizHours.some((hour) => hour.locationId === staff.locationId)
      ? typedBizHours.filter((hour) => hour.locationId === staff.locationId)
      : typedBizHours.filter((hour) => hour.locationId === null);
    const effectiveRules: AvailabilityRule[] = rules.length > 0
      ? rules
      : branchHours.length > 0
        ? branchHours.map((h) => ({ id: `biz-${h.id}`, staffId, dayOfWeek: h.dayOfWeek, startTime: h.startTime, endTime: h.endTime }))
        : [1, 2, 3, 4, 5].map((d) => ({
            id: `default-${staffId}-${d}`, staffId, dayOfWeek: d, startTime: '09:00', endTime: '17:00',
          }));

    const slots: TimeSlot[] = [];
    
    // To catch all possible slots that overlap with the UTC range [rangeStart, rangeEnd],
    // we search from 1 day before the start to 1 day after the end in the business timezone.
    let cursor = addDays(new Date(rangeStart), -1);
    const searchEnd = addDays(new Date(rangeEnd), 1);

    while (isBefore(cursor, searchEnd)) {
      const localDay = toZonedTime(cursor, businessTimezone);
      const dayOfWeek = getDay(localDay);
      const dayRules = effectiveRules.filter((r) => r.dayOfWeek === dayOfWeek);

      for (const rule of dayRules) {
        const daySlots = this.generateDaySlots(
          localDay,
          rule,
          service,
          appointments,
          effectiveTimeOffs,
          businessTimezone,
          timezone,
        );
        
        // Filter slots to ensure they are strictly within the requested UTC window.
        const filtered = daySlots.filter(s => 
          (isEqual(s.startsAt, rangeStart) || s.startsAt > rangeStart) &&
          (isEqual(s.endsAt, rangeEnd) || s.endsAt < rangeEnd)
        );
        slots.push(...filtered);
      }

      cursor = addDays(cursor, 1);
    }

    // Only return slots that are actually bookable, so the calendar never offers
    // a time that create() will reject. Past slots are always hidden; public
    // callers additionally honour the business's min-notice window.
    const minNoticeMs = dto.enforceNotice === 'false' ? 0 : (staff.business.minNoticeMinutes ?? 0) * 60_000;
    const earliest = new Date(Date.now() + minNoticeMs);
    let bookable = slots.filter((s) => s.startsAt >= earliest);

    // Two-way Google Calendar: for the owner's own provider, also hide any slot
    // that clashes with a personal event on their connected Google Calendar — so
    // their real-life schedule (and anything the waitlist would book into) stays
    // in sync. Best-effort: a Google hiccup never removes availability.
    if (staff.user?.role === 'OWNER' && bookable.length) {
      const busy = await this.google.busyIntervals(staff.businessId, rangeStart.toISOString(), rangeEnd.toISOString());
      if (busy.length) {
        bookable = bookable.filter((s) => !busy.some((b) => s.startsAt < b.end && s.endsAt > b.start));
      }
    }
    return bookable;
  }

  private generateDaySlots(
    localDay: Date,
    rule: AvailabilityRule,
    service: { id: string; durationMinutes: number; bufferBeforeMin: number; bufferAfterMin: number; capacity?: number },
    appointments: AppointmentWithServiceBuffers[],
    timeOffs: TimeOff[],
    businessTimezone: string,
    displayTimezone: string,
  ): TimeSlot[] {
    const capacity = Math.max(1, service.capacity ?? 1);
    const dateStr = format(localDay, 'yyyy-MM-dd');

    // Build window in UTC from the local times
    const windowStart = fromZonedTime(`${dateStr}T${rule.startTime}:00`, businessTimezone);
    const windowEnd = fromZonedTime(`${dateStr}T${rule.endTime}:00`, businessTimezone);

    const { durationMinutes, bufferBeforeMin, bufferAfterMin } = service;
    const totalSlotMinutes = bufferBeforeMin + durationMinutes + bufferAfterMin;

    const slots: TimeSlot[] = [];

    // First candidate: slot actual start (after buffer-before)
    let candidateStart = addMinutes(windowStart, bufferBeforeMin);

    while (true) {
      const actualEnd = addMinutes(candidateStart, durationMinutes);
      const occupiedStart = addMinutes(candidateStart, -bufferBeforeMin);
      const occupiedEnd = addMinutes(actualEnd, bufferAfterMin);

      // Stop if the occupied window exceeds the availability window
      if (occupiedEnd > windowEnd) {
        break;
      }

      // Group/class services: clients join the same instance (same service + exact
      // start) until capacity is full. Overlaps with anything else still block.
      const overlapping = appointments.filter(
        (apt) => {
          const aptOccupiedStart = addMinutes(apt.startsAt, -(apt.service?.bufferBeforeMin ?? 0));
          const aptOccupiedEnd = addMinutes(apt.endsAt, apt.service?.bufferAfterMin ?? 0);
          return occupiedStart < aptOccupiedEnd && occupiedEnd > aptOccupiedStart;
        },
      );
      const sameInstance = overlapping.filter(
        (apt) => apt.serviceId === service.id && +apt.startsAt === +candidateStart,
      );
      const otherOverlap = overlapping.length > sameInstance.length;
      const blockedByAppointment = otherOverlap || sameInstance.length >= capacity;

      const blockedByTimeOff = timeOffs.some(
        (to) => occupiedStart < to.endsAt && occupiedEnd > to.startsAt,
      );

      if (!blockedByAppointment && !blockedByTimeOff) {
        slots.push({
          startsAt: candidateStart,
          endsAt: actualEnd,
          startsAtLocal: formatTZ(toZonedTime(candidateStart, displayTimezone), 'yyyy-MM-dd\'T\'HH:mm:ssxxx', { timeZone: displayTimezone }),
          endsAtLocal: formatTZ(toZonedTime(actualEnd, displayTimezone), 'yyyy-MM-dd\'T\'HH:mm:ssxxx', { timeZone: displayTimezone }),
        });
      }

      candidateStart = addMinutes(candidateStart, totalSlotMinutes);
    }

    return slots;
  }

  // Used by BookingsService to validate a slot is still open (inside a transaction)
  async isSlotAvailable(
    staffId: string,
    startsAt: Date,
    endsAt: Date,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        staffId,
        status: { in: ['CONFIRMED', 'PENDING'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
    });
    return conflict === null;
  }
}
