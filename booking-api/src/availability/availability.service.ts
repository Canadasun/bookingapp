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

interface Interval {
  start: Date;
  end: Date;
}

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService, private google: GoogleCalendarService) {}

  async getAvailableSlots(dto: GetSlotsDto): Promise<TimeSlot[]> {
    const { staffId, serviceId, startDate, endDate, timezone } = dto;

    const [service, staff] = await Promise.all([
      this.prisma.service.findUnique({ where: { id: serviceId } }),
      this.prisma.staff.findUnique({
        where: { id: staffId },
        include: { business: true, user: { select: { role: true } } },
      }),
    ]);

    if (!service) throw new NotFoundException('Service not found');
    if (!staff) throw new NotFoundException('Staff not found');
    // Staff and service must belong to the same business, the staff must be
    // active, and actually offer this service — otherwise the returned slots
    // are meaningless (and could mix tenants).
    if (staff.businessId !== service.businessId) {
      throw new NotFoundException('Staff does not belong to this service’s business');
    }
    if (!staff.active) throw new NotFoundException('Staff is not available');
    const offersService = await this.prisma.staffService.findFirst({
      where: { staffId, serviceId },
    });
    if (!offersService) {
      // Sole-proprietor businesses (one active provider) skip per-service staff
      // assignment — the lone provider offers everything.
      const staffCount = await this.prisma.staff.count({ where: { businessId: staff.businessId, active: true } });
      if (staffCount > 1) throw new NotFoundException('Staff does not offer this service');
    }

    const businessTimezone = staff.business.timezone;

    // Parse dates in the requested timezone
    const rangeStart = fromZonedTime(`${startDate}T00:00:00`, timezone);
    const rangeEnd = fromZonedTime(`${endDate}T23:59:59`, timezone);

    const [rules, appointments, timeOffs] = await Promise.all([
      this.prisma.availabilityRule.findMany({ where: { staffId } }),
      this.prisma.appointment.findMany({
        where: {
          staffId,
          status: { in: ['CONFIRMED', 'PENDING'] },
          startsAt: { lt: rangeEnd },
          endsAt: { gt: rangeStart },
        },
      }),
      this.prisma.timeOff.findMany({
        where: {
          staffId,
          startsAt: { lt: rangeEnd },
          endsAt: { gt: rangeStart },
        },
      }),
    ]);

    // Honest default: a staff with NO configured availability rules is treated as
    // open during standard hours (every day, 9–5) so an owner can book right away
    // before they've set up a schedule — instead of "no availability" on a brand
    // new business. Any explicitly configured rules always take precedence.
    const effectiveRules: AvailabilityRule[] = rules.length > 0
      ? rules
      : [0, 1, 2, 3, 4, 5, 6].map((d) => ({
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
          timeOffs,
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
    service: { durationMinutes: number; bufferBeforeMin: number; bufferAfterMin: number },
    appointments: Appointment[],
    timeOffs: TimeOff[],
    businessTimezone: string,
    displayTimezone: string,
  ): TimeSlot[] {
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

      const blockedByAppointment = appointments.some(
        (apt) => occupiedStart < apt.endsAt && occupiedEnd > apt.startsAt,
      );

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
