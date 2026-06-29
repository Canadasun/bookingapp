import { z } from 'zod';

const AppointmentFieldsSchema = z.object({
  staffId: z.string().min(1),
  serviceId: z.string().min(1),
  additionalServiceIds: z.array(z.string().min(1)).max(10).optional(),
  startsAt: z.string().datetime(),
  notes: z.string().max(5000).optional(),
  allowOverride: z.boolean().optional(),
  // Answers to the business intake questions, captured at booking.
  intakeAnswers: z.array(z.object({
    label: z.string().min(1).max(200),
    answer: z.string().max(2000),
  })).max(20).optional(),
  referralSource: z.string().max(100).optional(),
  promoCodeId: z.string().cuid().optional(),
  // Explicit branch selected by the client/dashboard. The service validates
  // that the chosen provider belongs to this location before creating a booking.
  locationId: z.string().cuid().optional(),
  // Where to meet the client for an at-customer (mobile) service. Only stored
  // when the booked service's mode is CUSTOMER; ignored otherwise.
  customerAddress: z.string().max(500).optional(),
});

export const CreateAppointmentSchema = AppointmentFieldsSchema.extend({
  clientId: z.string().min(1),
  // Owner/staff-only per-appointment override of the service's default link.
  meetingUrl: z.string().trim().url().max(500).optional(),
});

export const PublicCreateAppointmentSchema = AppointmentFieldsSchema.extend({
  clientToken: z.string().min(1),
});

// Owner-initiated recurring series: the base booking + how it repeats. Each
// occurrence is created CONFIRMED; conflicting occurrences are skipped.
export const CreateRecurringSchema = CreateAppointmentSchema.extend({
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'THREE_WEEKS', 'EIGHT_WEEKS', 'MONTHLY']),
  count: z.number().int().min(1).max(12),
});

export const RescheduleSchema = z.object({
  startsAt: z.string().datetime(),
  staffId: z.string().optional(),
  token: z.string().optional(),
});

export const StatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']),
  cancelReason: z.string().max(1000).optional(),
  // Owner-only: when cancelling, also charge the business's configured
  // cancellation fee to the client's card on file (Pro). Ignored unless the
  // status is CANCELLED and a card + fee are in place.
  chargeCancellationFee: z.boolean().optional(),
});

export const UpdateAppointmentSchema = z.object({
  startsAt: z.string().datetime().optional(),
  clientName: z.string().min(1).max(200).optional(),
  clientEmail: z.string().email().optional(),
  clientPhone: z.string().max(30).optional(),
  notes: z.string().max(5000).optional(),
  notifyClient: z.boolean().default(true),
});

// The unauthenticated client "manage" page may ONLY cancel — never confirm /
// complete / no-show (which are owner actions). Keeps the public endpoint from
// being used to bypass the approval flow or fake completions.
export const PublicStatusSchema = z.object({
  status: z.literal('CANCELLED'),
  cancelReason: z.string().max(1000).optional(),
  token: z.string().optional(),
});

export const LateCancelRequestSchema = z.object({
  cancelReason: z.string().max(1000).optional(),
  token: z.string().optional(),
});

export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>;
export type PublicCreateAppointmentDto = z.infer<typeof PublicCreateAppointmentSchema>;
export type CreateRecurringDto = z.infer<typeof CreateRecurringSchema>;
export type RescheduleDto = z.infer<typeof RescheduleSchema>;
export type StatusDto = z.infer<typeof StatusSchema>;
export type PublicStatusDto = z.infer<typeof PublicStatusSchema>;
export type LateCancelRequestDto = z.infer<typeof LateCancelRequestSchema>;
export type UpdateAppointmentDto = z.infer<typeof UpdateAppointmentSchema>;
