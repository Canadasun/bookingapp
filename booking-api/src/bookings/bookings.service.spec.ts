import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { EventsGateway } from '../events/events.gateway';
import { AvailabilityService } from '../availability/availability.service';
import { CalendarSyncService } from '../calendar-sync/calendar-sync.service';
import { addMinutes } from 'date-fns';

// 7 days out: within the default 60-day max-advance and past the 120-min notice
// window, so public-booking policy checks pass.
const slotBase = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const SLOT_START = new Date(Date.UTC(slotBase.getUTCFullYear(), slotBase.getUTCMonth(), slotBase.getUTCDate(), 12));
const SLOT_END = new Date(SLOT_START.getTime() + 60 * 60 * 1000);

const mockAvailability = () => ({
  getAvailableSlots: jest.fn().mockResolvedValue([
    { startsAt: SLOT_START, endsAt: SLOT_END, startsAtLocal: '', endsAtLocal: '' },
  ]),
});

function makeAppointment(overrides = {}) {
  return {
    id: 'apt1',
    businessId: 'biz1',
    staffId: 'staff1',
    serviceId: 'svc1',
    clientId: 'client1',
    startsAt: SLOT_START,
    endsAt: SLOT_END,
    status: 'PENDING',
    depositCents: null,
    stripePaymentIntentId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    client: { id: 'client1', name: 'Jane Doe', email: 'jane@example.com', phone: null },
    service: { id: 'svc1', name: 'Haircut', durationMinutes: 60, bufferBeforeMin: 0, bufferAfterMin: 0, capacity: 1, resourceId: null },
    staff: { id: 'staff1', user: { name: 'Bob' } },
    business: {
      id: 'biz1',
      plan: 'FREE',
      minNoticeMinutes: 120,
      maxAdvanceDays: 60,
      allowClientReschedule: true,
      cancellationWindowHours: 24,
      cancellationFeeCents: 0,
    },
    ...overrides,
  };
}

function mockPrisma(options: { conflictExists?: boolean; bufferConflict?: boolean; closureExists?: boolean } = {}) {
  const promoCode = {
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
  };
  const txMock = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    appointment: {
      // A different-instance overlap (serviceId !== the booked service) signals a real conflict.
      findMany: jest.fn().mockResolvedValue(
        options.conflictExists ? [{
          serviceId: 'other',
          startsAt: SLOT_START,
          endsAt: SLOT_END,
          service: { bufferBeforeMin: 0, bufferAfterMin: 0 },
        }] : options.bufferConflict ? [{
          serviceId: 'previous',
          startsAt: addMinutes(SLOT_START, -60),
          endsAt: SLOT_START,
          service: { bufferBeforeMin: 0, bufferAfterMin: 30 },
        }] : [],
      ),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(makeAppointment()),
      update: jest.fn().mockResolvedValue(makeAppointment({ status: 'CONFIRMED' })),
    },
    business: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) },
    location: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) },
    availabilityRule: { findMany: jest.fn().mockResolvedValue([{ dayOfWeek: 0, startTime: '00:00', endTime: '23:59' }]) },
    businessHours: { findMany: jest.fn().mockResolvedValue([]) },
    timeOff: { findFirst: jest.fn().mockResolvedValue(null) },
    businessClosure: { findFirst: jest.fn().mockResolvedValue(options.closureExists ? { id: 'closure1' } : null) },
    promoCode,
  };

  return {
    service: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'svc1',
        durationMinutes: 60,
        priceCents: 10000,
        active: true,
        bufferBeforeMin: 0,
        bufferAfterMin: 0,
        capacity: 1,
        resourceId: null,
      }),
      findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'svc1', durationMinutes: 60, active: true, bufferBeforeMin: 0, bufferAfterMin: 0, capacity: 1, resourceId: null }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'svc1',
        durationMinutes: 60,
        active: true,
        bufferBeforeMin: 0,
        bufferAfterMin: 0,
        capacity: 1,
        resourceId: null,
      }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'svc1', durationMinutes: 60, active: true, bufferBeforeMin: 0, bufferAfterMin: 0, capacity: 1, resourceId: null }),
    },
    staff: {
      findFirst: jest.fn().mockResolvedValue({ id: 'staff1', businessId: 'biz1', active: true }),
    },
    staffLocation: {
      count: jest.fn().mockResolvedValue(0),
    },
    location: {
      findFirst: jest.fn().mockResolvedValue({ id: 'location-a' }),
      count: jest.fn().mockResolvedValue(2),
    },
    client: {
      findFirst: jest.fn().mockResolvedValue({ id: 'client1', businessId: 'biz1' }),
    },
    staffService: {
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue({ staffId: 'staff1', serviceId: 'svc1' }),
    },
    business: {
      findUnique: jest.fn().mockResolvedValue({ minNoticeMinutes: 120, maxAdvanceDays: 60, allowClientReschedule: true, timezone: 'UTC' }),
    },
    appointment: {
      findMany: jest.fn().mockResolvedValue([makeAppointment()]),
      findUnique: jest.fn().mockResolvedValue(makeAppointment()),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        if (options.conflictExists && where.status) {
          return Promise.resolve({ id: 'conflict' });
        }
        return Promise.resolve(makeAppointment());
      }),
      create: jest.fn().mockResolvedValue(makeAppointment()),
      update: jest.fn().mockResolvedValue(makeAppointment({ status: 'CONFIRMED' })),
    },
    payment: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    waitlistEntry: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    availabilityRule: {
      findMany: jest.fn().mockResolvedValue([{ dayOfWeek: 0, startTime: '00:00', endTime: '23:59' }]),
    },
    businessHours: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    timeOff: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    businessClosure: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    promoCode,
    $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => {
      return fn(txMock);
    }),
  };
}

async function buildService(prismaOverrides = {}, conflictExists = false) {
  const prisma = { ...mockPrisma({ conflictExists }), ...prismaOverrides };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      BookingsService,
      { provide: EventsGateway, useValue: { emitBookingUpdate: jest.fn() } },
      { provide: PaymentsService, useValue: { chargeCancellationFee: jest.fn().mockResolvedValue({ charged: false, feeCents: 0 }) } },
      { provide: AvailabilityService, useValue: mockAvailability() },
      { provide: CalendarSyncService, useValue: { syncWithRetry: jest.fn().mockResolvedValue(true), removeWithRetry: jest.fn().mockResolvedValue(true) } },
      { provide: PrismaService, useValue: prisma },
      {
        provide: NotificationsService,
        useValue: {
          scheduleReminders: jest.fn(),
          cancelReminders: jest.fn(),
          sendCancellation: jest.fn(),
          sendConfirmation: jest.fn().mockResolvedValue(undefined),
          sendPendingNotification: jest.fn().mockResolvedValue(undefined),
          sendAdminBookingAlert: jest.fn().mockResolvedValue(undefined),
          sendReschedule: jest.fn().mockResolvedValue(undefined),
          sendStaffCancellation: jest.fn().mockResolvedValue(undefined),
          notifyWaitlistOpening: jest.fn().mockResolvedValue(undefined),
          sendReviewRequest: jest.fn().mockResolvedValue(undefined),
        },
      },
    ],
  }).compile();
  return { svc: module.get<BookingsService>(BookingsService), prisma, availability: module.get(AvailabilityService) };
}

describe('BookingsService', () => {
  describe('create', () => {
    it('creates an appointment when slot is free', async () => {
      const { svc } = await buildService();
      const result = await svc.create('biz1', {
        staffId: 'staff1',
        serviceId: 'svc1',
        clientId: 'client1',
        startsAt: SLOT_START.toISOString(),
      });
      expect(result.status).toBe('PENDING');
    });

    it('allows an unassigned owner provider to offer all services', async () => {
      const { svc, prisma } = await buildService({
        staffService: {
          count: jest.fn().mockResolvedValue(0),
          findFirst: jest.fn().mockResolvedValue(null),
        },
      });
      const result = await svc.create('biz1', {
        staffId: 'staff1',
        serviceId: 'svc1',
        clientId: 'client1',
        startsAt: SLOT_START.toISOString(),
      });
      expect(result.status).toBe('PENDING');
      expect(prisma.staffService.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a location that does not match the selected provider', async () => {
      const { svc } = await buildService({
        staff: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'staff1',
            businessId: 'biz1',
            active: true,
            locationId: 'location-a',
          }),
        },
      });

      await expect(svc.create('biz1', {
        staffId: 'staff1',
        serviceId: 'svc1',
        clientId: 'client1',
        startsAt: SLOT_START.toISOString(),
        locationId: 'location-b',
      })).rejects.toThrow('The selected provider is not available at this location');
    });

    it('assigns an unassigned provider to the only active location', async () => {
      const { svc, prisma } = await buildService({
        location: {
          findFirst: jest.fn().mockResolvedValue({ id: 'location-a' }),
          count: jest.fn().mockResolvedValue(1),
        },
      });

      await svc.create('biz1', {
        staffId: 'staff1',
        serviceId: 'svc1',
        clientId: 'client1',
        startsAt: SLOT_START.toISOString(),
        locationId: 'location-a',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.location.count).toHaveBeenCalledWith({ where: { businessId: 'biz1', active: true } });
    });

    // Regression (BUG-1): a multi-branch provider booked at a NON-primary branch
    // must be validated against THAT branch's hours/timezone, not their primary.
    it('validates availability against the booked branch, not the provider primary', async () => {
      const { svc, availability } = await buildService({
        staff: { findFirst: jest.fn().mockResolvedValue({ id: 'staff1', businessId: 'biz1', active: true, locationId: 'location-primary' }) },
        staffLocation: { count: jest.fn().mockResolvedValue(1) }, // serves the requested branch
      });

      await svc.create('biz1', {
        staffId: 'staff1',
        serviceId: 'svc1',
        clientId: 'client1',
        startsAt: SLOT_START.toISOString(),
        locationId: 'location-b',
      });

      expect(availability.getAvailableSlots).toHaveBeenCalledWith(
        expect.objectContaining({ locationId: 'location-b' }),
      );
    });

    it('throws ConflictException when slot is taken', async () => {
      const { svc } = await buildService({}, true);
      await expect(
        svc.create('biz1', {
          staffId: 'staff1',
          serviceId: 'svc1',
          clientId: 'client1',
          startsAt: SLOT_START.toISOString(),
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('prevents staff from creating bookings for another provider', async () => {
      const { svc } = await buildService({
        staff: {
          findFirst: jest.fn().mockResolvedValue({ id: 'staff2', businessId: 'biz1', active: true }),
        },
      });

      await expect(
        svc.create(
          'biz1',
          {
            staffId: 'staff1',
            serviceId: 'svc1',
            clientId: 'client1',
            startsAt: SLOT_START.toISOString(),
          },
          { confirmed: true, actor: { id: 'user2', role: 'STAFF' } },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a slot that overlaps an existing appointment buffer', async () => {
      const { svc } = await buildService(mockPrisma({ bufferConflict: true }));
      await expect(
        svc.create('biz1', {
          staffId: 'staff1',
          serviceId: 'svc1',
          clientId: 'client1',
          startsAt: SLOT_START.toISOString(),
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a slot inside a business closure during the transaction', async () => {
      const { svc } = await buildService(mockPrisma({ closureExists: true }));
      await expect(
        svc.create('biz1', {
          staffId: 'staff1',
          serviceId: 'svc1',
          clientId: 'client1',
          startsAt: SLOT_START.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when service does not exist', async () => {
      const { svc } = await buildService({
        service: {
          findFirst: jest.fn().mockResolvedValue(null),
          findFirstOrThrow: jest.fn().mockRejectedValue(new NotFoundException()),
          findUnique: jest.fn().mockResolvedValue(null),
          findUniqueOrThrow: jest.fn().mockRejectedValue(new NotFoundException()),
        },
      });
      await expect(
        svc.create('biz1', {
          staffId: 'staff1',
          serviceId: 'nonexistent',
          clientId: 'client1',
          startsAt: SLOT_START.toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('calculates promo discounts on the server and consumes them transactionally', async () => {
      const { svc, prisma } = await buildService();
      prisma.promoCode.findFirst.mockResolvedValue({
        id: 'promo1', businessId: 'biz1', active: true, expiresAt: null,
        maxUsages: 10, usageCount: 2, discountType: 'PERCENT', discountValue: 25,
      });

      await svc.create('biz1', {
        staffId: 'staff1', serviceId: 'svc1', clientId: 'client1',
        startsAt: SLOT_START.toISOString(), promoCodeId: 'promo1',
      });

      expect(prisma.promoCode.update).toHaveBeenCalledWith({
        where: { id: 'promo1', businessId: 'biz1' }, data: { usageCount: { increment: 1 } },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('concurrency — 50 simultaneous requests on the same slot', () => {
    it('allows exactly one booking to succeed when slot is contested', async () => {
      let booked = false;

      const txMock = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        appointment: {
          // Simulate the real race: first caller sees no overlap, all subsequent
          // see a different-instance overlap (= conflict).
          findMany: jest.fn().mockImplementation(() => {
            if (!booked) {
              booked = true;
              return Promise.resolve([]);
            }
            return Promise.resolve([{
              serviceId: 'other',
              startsAt: SLOT_START,
              endsAt: SLOT_END,
              service: { bufferBeforeMin: 0, bufferAfterMin: 0 },
            }]);
          }),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(makeAppointment()),
        },
        business: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) },
        availabilityRule: { findMany: jest.fn().mockResolvedValue([{ dayOfWeek: 0, startTime: '00:00', endTime: '23:59' }]) },
        businessHours: { findMany: jest.fn().mockResolvedValue([]) },
        timeOff: { findFirst: jest.fn().mockResolvedValue(null) },
        businessClosure: { findFirst: jest.fn().mockResolvedValue(null) },
      };

      const prisma = {
        service: { findFirst: jest.fn().mockResolvedValue({ id: 'svc1', durationMinutes: 60, active: true, bufferBeforeMin: 0, bufferAfterMin: 0, capacity: 1, resourceId: null }) },
        staff: { findFirst: jest.fn().mockResolvedValue({ id: 'staff1', businessId: 'biz1', active: true }) },
        client: { findFirst: jest.fn().mockResolvedValue({ id: 'client1', businessId: 'biz1' }) },
        staffService: { count: jest.fn().mockResolvedValue(1), findFirst: jest.fn().mockResolvedValue({ staffId: 'staff1', serviceId: 'svc1' }) },
        business: { findUnique: jest.fn().mockResolvedValue({ minNoticeMinutes: 120, maxAdvanceDays: 60, timezone: 'UTC' }) },
        appointment: { findFirst: jest.fn().mockResolvedValue(makeAppointment()) },
        availabilityRule: { findMany: jest.fn().mockResolvedValue([{ dayOfWeek: 0, startTime: '00:00', endTime: '23:59' }]) },
        businessHours: { findMany: jest.fn().mockResolvedValue([]) },
        timeOff: { findFirst: jest.fn().mockResolvedValue(null) },
        businessClosure: { findFirst: jest.fn().mockResolvedValue(null) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BookingsService,
          { provide: EventsGateway, useValue: { emitBookingUpdate: jest.fn() } },
          { provide: PaymentsService, useValue: { chargeCancellationFee: jest.fn().mockResolvedValue({ charged: false, feeCents: 0 }) } },
          { provide: AvailabilityService, useValue: mockAvailability() },
          { provide: CalendarSyncService, useValue: { syncWithRetry: jest.fn().mockResolvedValue(true), removeWithRetry: jest.fn().mockResolvedValue(true) } },
          { provide: PrismaService, useValue: prisma },
          {
            provide: NotificationsService,
            useValue: {
              scheduleReminders: jest.fn(),
              cancelReminders: jest.fn(),
              sendConfirmation: jest.fn().mockResolvedValue(undefined),
              sendPendingNotification: jest.fn().mockResolvedValue(undefined),
              sendAdminBookingAlert: jest.fn().mockResolvedValue(undefined),
            },
          },
        ],
      }).compile();

      const svc = module.get<BookingsService>(BookingsService);

      const dto = {
        staffId: 'staff1',
        serviceId: 'svc1',
        clientId: 'client1',
        startsAt: SLOT_START.toISOString(),
      };

      const results = await Promise.allSettled(
        Array.from({ length: 50 }, () => svc.create('biz1', dto)),
      );

      const successes = results.filter((r) => r.status === 'fulfilled');
      const conflicts = results.filter(
        (r) => r.status === 'rejected' && r.reason instanceof ConflictException,
      );

      expect(successes).toHaveLength(1);
      expect(conflicts).toHaveLength(49);
    });
  });

  describe('admin alert', () => {
    it('enqueues admin-alert job with correct appointmentId on successful booking', async () => {
      const sendAdminBookingAlert = jest.fn().mockResolvedValue(undefined);
      const sendConfirmation = jest.fn().mockResolvedValue(undefined);
      const sendPendingNotification = jest.fn().mockResolvedValue(undefined);
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BookingsService,
          { provide: EventsGateway, useValue: { emitBookingUpdate: jest.fn() } },
          { provide: PaymentsService, useValue: { chargeCancellationFee: jest.fn().mockResolvedValue({ charged: false, feeCents: 0 }) } },
          { provide: AvailabilityService, useValue: mockAvailability() },
          { provide: CalendarSyncService, useValue: { syncWithRetry: jest.fn().mockResolvedValue(true), removeWithRetry: jest.fn().mockResolvedValue(true) } },
          { provide: PrismaService, useValue: mockPrisma() },
          {
            provide: NotificationsService,
            useValue: {
              sendConfirmation,
              sendPendingNotification,
              sendAdminBookingAlert,
              cancelReminders: jest.fn(),
              scheduleReminders: jest.fn(),
              sendCancellation: jest.fn(),
            },
          },
        ],
      }).compile();
      const svc = module.get<BookingsService>(BookingsService);
      await svc.create('biz1', {
        staffId: 'staff1', serviceId: 'svc1',
        clientId: 'client1', startsAt: SLOT_START.toISOString(),
      });
      expect(sendAdminBookingAlert).toHaveBeenCalledWith('apt1');
      expect(sendPendingNotification).toHaveBeenCalled();
    });
  });

  describe('confirm', () => {
    it('updates status to CONFIRMED and schedules reminders', async () => {
      const { svc } = await buildService();
      const result = await svc.confirm('apt1', 'biz1');
      expect(result.status).toBe('CONFIRMED');
    });

    it('rejects confirmation when a Basic+ mandatory deposit has not been paid', async () => {
      const { svc } = await buildService({
        appointment: {
          ...mockPrisma().appointment,
          findFirst: jest.fn().mockResolvedValue(makeAppointment({
            business: {
              id: 'biz1',
              plan: 'BASIC',
              requireDeposit: true,
              minNoticeMinutes: 120,
              maxAdvanceDays: 60,
              allowClientReschedule: true,
              cancellationWindowHours: 24,
              cancellationFeeCents: 0,
            },
          })),
        },
      });

      await expect(svc.confirm('apt1', 'biz1')).rejects.toThrow(BadRequestException);
    });

    it('prevents staff from confirming another provider appointment', async () => {
      const { svc } = await buildService({
        staff: {
          findFirst: jest.fn().mockResolvedValue({ id: 'staff2', businessId: 'biz1', active: true }),
        },
      });

      await expect(
        svc.confirm('apt1', 'biz1', 'user2', { id: 'user2', role: 'STAFF' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reschedule', () => {
    it('allows an unassigned owner provider to reschedule services', async () => {
      const { svc, prisma } = await buildService({
        staffService: {
          count: jest.fn().mockResolvedValue(0),
          findFirst: jest.fn().mockResolvedValue(null),
        },
      });

      await expect(
        svc.reschedule('apt1', { startsAt: SLOT_START.toISOString() }, undefined, { byClient: true }),
      ).resolves.toBeDefined();
      expect(prisma.staffService.findFirst).not.toHaveBeenCalled();
    });

    it('rejects public client reschedule inside the cancellation window', async () => {
      const startsAt = new Date(Date.now() + 60 * 60 * 1000);
      const { svc } = await buildService({
        appointment: {
          ...mockPrisma().appointment,
          findFirst: jest.fn().mockResolvedValue(makeAppointment({ startsAt })),
        },
      });

      await expect(
        svc.reschedule('apt1', { startsAt: SLOT_START.toISOString() }, undefined, { byClient: true }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects public client reschedule when online rescheduling is disabled', async () => {
      const { svc } = await buildService({
        appointment: {
          ...mockPrisma().appointment,
          findFirst: jest.fn().mockResolvedValue(makeAppointment({
            business: {
              id: 'biz1',
              plan: 'FREE',
              minNoticeMinutes: 120,
              maxAdvanceDays: 60,
              allowClientReschedule: false,
              cancellationWindowHours: 24,
              cancellationFeeCents: 0,
            },
          })),
        },
      });

      await expect(
        svc.reschedule('apt1', { startsAt: SLOT_START.toISOString() }, undefined, { byClient: true }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects public client reschedule inside the minimum notice window', async () => {
      const { svc } = await buildService();
      const tooSoon = new Date(Date.now() + 30 * 60 * 1000);

      await expect(
        svc.reschedule('apt1', { startsAt: tooSoon.toISOString() }, undefined, { byClient: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects reschedule when the service has been deactivated', async () => {
      const { svc } = await buildService({
        service: {
          ...mockPrisma().service,
          findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'svc1', durationMinutes: 60, active: false }),
        },
      });

      await expect(
        svc.reschedule('apt1', { startsAt: SLOT_START.toISOString() }, 'biz1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    it('prioritizes exact-slot waitlist entries when a booking is cancelled', async () => {
      const waitlistFindFirst = jest.fn().mockResolvedValue({ id: 'wait1' });
      const waitlistUpdate = jest.fn().mockResolvedValue({});
      const { svc } = await buildService({
        waitlistEntry: {
          findFirst: waitlistFindFirst,
          update: waitlistUpdate,
        },
      });

      await svc.updateStatus('apt1', { status: 'CANCELLED' }, 'biz1', true);

      expect(waitlistFindFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz1',
          status: 'WAITING',
          serviceId: 'svc1',
          staffId: 'staff1',
          desiredDate: SLOT_START,
        }),
      }));
      expect(waitlistUpdate).toHaveBeenCalledWith({ where: { id: 'wait1', businessId: 'biz1' }, data: { status: 'NOTIFIED' } });
    });

    it('cancels reminders when status set to CANCELLED', async () => {
      const cancelReminders = jest.fn();
      const sendCancellation = jest.fn();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BookingsService,
          { provide: EventsGateway, useValue: { emitBookingUpdate: jest.fn() } },
          { provide: PaymentsService, useValue: { chargeCancellationFee: jest.fn().mockResolvedValue({ charged: false, feeCents: 0 }) } },
          { provide: AvailabilityService, useValue: mockAvailability() },
          { provide: CalendarSyncService, useValue: { syncWithRetry: jest.fn().mockResolvedValue(true), removeWithRetry: jest.fn().mockResolvedValue(true) } },
          { provide: PrismaService, useValue: mockPrisma() },
          {
            provide: NotificationsService,
            useValue: { scheduleReminders: jest.fn(), cancelReminders, sendCancellation },
          },
        ],
      }).compile();
      const svc = module.get<BookingsService>(BookingsService);
      await svc.updateStatus('apt1', { status: 'CANCELLED' }, 'biz1');
      expect(cancelReminders).toHaveBeenCalledWith('apt1');
      expect(sendCancellation).toHaveBeenCalled();
    });

    it('rejects cancelling an appointment that is already closed', async () => {
      const { svc } = await buildService({
        appointment: {
          ...mockPrisma().appointment,
          findFirst: jest.fn().mockResolvedValue(makeAppointment({ status: 'COMPLETED' })),
        },
      });

      await expect(svc.updateStatus('apt1', { status: 'CANCELLED' }, 'biz1')).rejects.toThrow(BadRequestException);
    });

    it('records userId on authenticated owner or staff status changes', async () => {
      const { svc, prisma } = await buildService();
      await svc.updateStatus('apt1', { status: 'CANCELLED' }, 'biz1', true, 'user1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user1' }),
        }),
      );
    });
  });
});
