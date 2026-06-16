import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from '../calendar-sync/google-calendar.service';
import { addMinutes, addDays } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

const TZ = 'America/New_York';

function makeService(overrides = {}) {
  return {
    id: 'svc1',
    businessId: 'biz1',
    name: 'Haircut',
    durationMinutes: 60,
    priceCents: 5000,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    active: true,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeStaff() {
  return {
    id: 'staff1',
    userId: 'u1',
    businessId: 'biz1',
    bio: null,
    avatarUrl: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    business: { timezone: TZ },
  };
}

// 2024-03-04 is a Monday
const MONDAY = '2024-03-04';

function localUtc(date: string, time: string) {
  return fromZonedTime(`${date}T${time}:00`, TZ);
}

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    service: { findUnique: jest.fn().mockResolvedValue(makeService()), findMany: jest.fn().mockResolvedValue([]) },
    staff: { findUnique: jest.fn().mockResolvedValue(makeStaff()) },
    staffService: { count: jest.fn().mockResolvedValue(1), findFirst: jest.fn().mockResolvedValue({ staffId: 'staff1', serviceId: 'svc1' }) },
    appointment: { findMany: jest.fn().mockResolvedValue([]) },
    timeOff: { findMany: jest.fn().mockResolvedValue([]) },
    businessHours: { findMany: jest.fn().mockResolvedValue([]) },
    businessClosure: { findMany: jest.fn().mockResolvedValue([]) },
    availabilityRule: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'r1', staffId: 'staff1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      ]),
    },
    ...overrides,
  };
}

async function buildService(prismaOverrides = {}) {
  const prisma = mockPrisma(prismaOverrides);
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AvailabilityService,
      { provide: PrismaService, useValue: prisma },
      { provide: GoogleCalendarService, useValue: { busyIntervals: jest.fn().mockResolvedValue([]) } },
    ],
  }).compile();
  return { svc: module.get<AvailabilityService>(AvailabilityService), prisma };
}

describe('AvailabilityService', () => {
  // Pin "now" to just before the fixed 2024 test dates so the service's
  // past-slot filter doesn't strip the expected slots.
  beforeAll(() => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }); jest.setSystemTime(new Date('2024-03-01T00:00:00Z')); });
  afterAll(() => { jest.useRealTimers(); });

  describe('getAvailableSlots — basic', () => {
    it('returns hourly slots for a 9–17 Monday window', async () => {
      const { svc } = await buildService();
      const slots = await svc.getAvailableSlots({
        staffId: 'staff1',
        serviceId: 'svc1',
        startDate: MONDAY,
        endDate: MONDAY,
        timezone: TZ,
      });
      // 9–17 = 8 hours → 8 x 60-min slots
      expect(slots).toHaveLength(8);
      expect(slots[0].startsAt).toEqual(localUtc(MONDAY, '09:00'));
      expect(slots[0].endsAt).toEqual(localUtc(MONDAY, '10:00'));
      expect(slots[7].startsAt).toEqual(localUtc(MONDAY, '16:00'));
    });

    it('treats providers with no explicit assignments as offering all services', async () => {
      const { svc, prisma } = await buildService({
        staffService: {
          count: jest.fn().mockResolvedValue(0),
          findFirst: jest.fn().mockResolvedValue(null),
        },
      });
      const slots = await svc.getAvailableSlots({
        staffId: 'staff1',
        serviceId: 'svc1',
        startDate: MONDAY,
        endDate: MONDAY,
        timezone: TZ,
      });
      expect(slots).toHaveLength(8);
      expect(prisma.staffService.findFirst).not.toHaveBeenCalled();
    });

    it('returns no slots on a day with no availability rule (Tuesday)', async () => {
      const { svc } = await buildService();
      const slots = await svc.getAvailableSlots({
        staffId: 'staff1',
        serviceId: 'svc1',
        startDate: '2024-03-05', // Tuesday
        endDate: '2024-03-05',
        timezone: TZ,
      });
      expect(slots).toHaveLength(0);
    });

    it('spans a multi-day range and aggregates correctly', async () => {
      const { svc } = await buildService();
      // Monday + next Monday
      const slots = await svc.getAvailableSlots({
        staffId: 'staff1',
        serviceId: 'svc1',
        startDate: MONDAY,
        endDate: '2024-03-11', // next Monday
        timezone: TZ,
      });
      expect(slots).toHaveLength(16); // 8 slots × 2 Mondays
    });

    it('uses combined duration when additional services are selected', async () => {
      const { svc } = await buildService({
        service: {
          findUnique: jest.fn().mockResolvedValue(makeService({ durationMinutes: 60 })),
          findMany: jest.fn().mockResolvedValue([makeService({ id: 'svc2', durationMinutes: 30 })]),
        },
        staffService: {
          count: jest.fn()
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(2),
          findFirst: jest.fn().mockResolvedValue({ staffId: 'staff1', serviceId: 'svc1' }),
        },
      });
      const slots = await svc.getAvailableSlots({
        staffId: 'staff1',
        serviceId: 'svc1',
        additionalServiceIds: ['svc2'],
        startDate: MONDAY,
        endDate: MONDAY,
        timezone: TZ,
      });
      expect(slots).toHaveLength(5);
      expect(slots[0].startsAt).toEqual(localUtc(MONDAY, '09:00'));
      expect(slots[0].endsAt).toEqual(localUtc(MONDAY, '10:30'));
    });
  });

  describe('getAvailableSlots — appointment conflicts', () => {
    it('removes slots that overlap with an existing confirmed appointment', async () => {
      const blockedStart = localUtc(MONDAY, '10:00');
      const blockedEnd = localUtc(MONDAY, '11:00');
      const { svc } = await buildService({
        appointment: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'apt1',
              staffId: 'staff1',
              startsAt: blockedStart,
              endsAt: blockedEnd,
              status: 'CONFIRMED',
            },
          ]),
        },
      });
      const slots = await svc.getAvailableSlots({
        staffId: 'staff1',
        serviceId: 'svc1',
        startDate: MONDAY,
        endDate: MONDAY,
        timezone: TZ,
      });
      // 10:00 slot is gone
      expect(slots).toHaveLength(7);
      expect(slots.find((s) => s.startsAt.getTime() === blockedStart.getTime())).toBeUndefined();
    });

    it('handles back-to-back bookings leaving no gap', async () => {
      const { svc } = await buildService({
        service: { findUnique: jest.fn().mockResolvedValue(makeService({ durationMinutes: 60 })) },
        appointment: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'apt1', staffId: 'staff1', startsAt: localUtc(MONDAY, '09:00'), endsAt: localUtc(MONDAY, '10:00'), status: 'CONFIRMED' },
            { id: 'apt2', staffId: 'staff1', startsAt: localUtc(MONDAY, '10:00'), endsAt: localUtc(MONDAY, '11:00'), status: 'PENDING' },
            { id: 'apt3', staffId: 'staff1', startsAt: localUtc(MONDAY, '11:00'), endsAt: localUtc(MONDAY, '12:00'), status: 'CONFIRMED' },
          ]),
        },
      });
      const slots = await svc.getAvailableSlots({
        staffId: 'staff1',
        serviceId: 'svc1',
        startDate: MONDAY,
        endDate: MONDAY,
        timezone: TZ,
      });
      // 9,10,11 blocked → 12,13,14,15,16 free = 5
      expect(slots).toHaveLength(5);
    });
  });

  describe('getAvailableSlots — time-off', () => {
    it('excludes slots covered by time-off', async () => {
      const { svc } = await buildService({
        timeOff: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'to1',
              staffId: 'staff1',
              startsAt: localUtc(MONDAY, '12:00'),
              endsAt: localUtc(MONDAY, '14:00'),
              reason: 'Lunch extended',
            },
          ]),
        },
      });
      const slots = await svc.getAvailableSlots({
        staffId: 'staff1',
        serviceId: 'svc1',
        startDate: MONDAY,
        endDate: MONDAY,
        timezone: TZ,
      });
      // 12:00 and 13:00 slots removed → 6 remain
      expect(slots).toHaveLength(6);
    });

    it('all-day time-off yields no slots', async () => {
      const { svc } = await buildService({
        timeOff: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'to1',
              staffId: 'staff1',
              startsAt: localUtc(MONDAY, '00:00'),
              endsAt: localUtc(MONDAY, '23:59'),
              reason: 'Day off',
            },
          ]),
        },
      });
      const slots = await svc.getAvailableSlots({
        staffId: 'staff1',
        serviceId: 'svc1',
        startDate: MONDAY,
        endDate: MONDAY,
        timezone: TZ,
      });
      expect(slots).toHaveLength(0);
    });
  });

  describe('getAvailableSlots — buffers', () => {
    it('respects bufferBeforeMin and bufferAfterMin', async () => {
      const { svc } = await buildService({
        service: {
          findUnique: jest.fn().mockResolvedValue(
            makeService({ durationMinutes: 30, bufferBeforeMin: 10, bufferAfterMin: 10 }),
          ),
        },
      });
      // Total slot = 10 + 30 + 10 = 50min
      // Window 09:00–17:00 = 480min → floor(480/50) = 9 slots but first starts at 09:10
      const slots = await svc.getAvailableSlots({
        staffId: 'staff1',
        serviceId: 'svc1',
        startDate: MONDAY,
        endDate: MONDAY,
        timezone: TZ,
      });
      expect(slots.length).toBeGreaterThan(0);
      // First actual slot starts 10min into window
      expect(slots[0].startsAt).toEqual(localUtc(MONDAY, '09:10'));
      expect(slots[0].endsAt).toEqual(localUtc(MONDAY, '09:40'));
    });

    it('buffer-blocked slots are excluded from results', async () => {
      // Service: 60min duration, 15min buffer before/after → occupied = 90min
      // Appointment at 11:00–12:00 blocks any slot whose occupied window overlaps
      const blockedAppt = {
        id: 'apt1',
        staffId: 'staff1',
        startsAt: localUtc(MONDAY, '11:00'),
        endsAt: localUtc(MONDAY, '12:00'),
        status: 'CONFIRMED',
      };
      const { svc } = await buildService({
        service: {
          findUnique: jest.fn().mockResolvedValue(
            makeService({ durationMinutes: 60, bufferBeforeMin: 15, bufferAfterMin: 15 }),
          ),
        },
        appointment: { findMany: jest.fn().mockResolvedValue([blockedAppt]) },
      });
      const slots = await svc.getAvailableSlots({
        staffId: 'staff1',
        serviceId: 'svc1',
        startDate: MONDAY,
        endDate: MONDAY,
        timezone: TZ,
      });
      // A slot starting at 10:00 would occupy 09:45–11:15, which overlaps the 11:00 appointment
      const tenOclock = localUtc(MONDAY, '10:00');
      expect(slots.find((s) => s.startsAt.getTime() === tenOclock.getTime())).toBeUndefined();
    });

    it('respects buffers from existing appointments when listing other services', async () => {
      const { svc } = await buildService({
        service: {
          findUnique: jest.fn().mockResolvedValue(makeService({ durationMinutes: 60, bufferBeforeMin: 0, bufferAfterMin: 0 })),
        },
        appointment: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'apt1',
              staffId: 'staff1',
              serviceId: 'svc-other',
              startsAt: localUtc(MONDAY, '09:00'),
              endsAt: localUtc(MONDAY, '10:00'),
              status: 'CONFIRMED',
              service: { bufferBeforeMin: 0, bufferAfterMin: 30 },
            },
          ]),
        },
      });
      const slots = await svc.getAvailableSlots({
        staffId: 'staff1',
        serviceId: 'svc1',
        startDate: MONDAY,
        endDate: MONDAY,
        timezone: TZ,
      });
      const tenOclock = localUtc(MONDAY, '10:00');
      expect(slots.find((s) => s.startsAt.getTime() === tenOclock.getTime())).toBeUndefined();
    });
  });

  describe('DST edge cases', () => {
    it('correctly handles spring-forward DST in America/New_York', async () => {
      // 2024-03-10 is the spring-forward day in US Eastern (clocks jump 2am→3am)
      const DST_DAY = '2024-03-10';
      const { svc } = await buildService({
        availabilityRule: {
          findMany: jest.fn().mockResolvedValue([
            // dayOfWeek 0 = Sunday
            { id: 'r1', staffId: 'staff1', dayOfWeek: 0, startTime: '09:00', endTime: '17:00' },
          ]),
        },
      });
      const slots = await svc.getAvailableSlots({
        staffId: 'staff1',
        serviceId: 'svc1',
        startDate: DST_DAY,
        endDate: DST_DAY,
        timezone: TZ,
      });
      // Should still have 8 slots — DST does not collapse the local 9–17 window
      expect(slots).toHaveLength(8);
      // First slot in UTC should be 14:00 UTC (09:00 EDT = UTC-4)
      expect(slots[0].startsAt.getUTCHours()).toBe(13); // 09:00 EDT = UTC-4 = 13:00 UTC
    });
  });

  describe('isSlotAvailable', () => {
    it('returns true when no conflicting appointments exist', async () => {
      const { svc } = await buildService({
        appointment: { findFirst: jest.fn().mockResolvedValue(null) },
      });
      const result = await svc.isSlotAvailable(
        'staff1',
        localUtc(MONDAY, '10:00'),
        localUtc(MONDAY, '11:00'),
      );
      expect(result).toBe(true);
    });

    it('returns false when a conflicting appointment exists', async () => {
      const { svc } = await buildService({
        appointment: {
          findFirst: jest.fn().mockResolvedValue({ id: 'apt1' }),
        },
      });
      const result = await svc.isSlotAvailable(
        'staff1',
        localUtc(MONDAY, '10:00'),
        localUtc(MONDAY, '11:00'),
      );
      expect(result).toBe(false);
    });
  });
});
