import { z } from 'zod';

export const CreateAppointmentSchema = z.object({
  staffId: z.string().min(1),
  serviceId: z.string().min(1),
  additionalServiceIds: z.array(z.string().min(1)).optional(),
  clientId: z.string().min(1),
  startsAt: z.string().datetime(),
  notes: z.string().optional(),
  allowOverride: z.boolean().optional(),
  // Answers to the business intake questions, captured at booking.
  intakeAnswers: z.array(z.object({
    label: z.string().min(1).max(200),
    answer: z.string().max(2000),
  })).max(20).optional(),
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
});

export const StatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']),
  cancelReason: z.string().optional(),
  // Owner-only: when cancelling, also charge the business's configured
  // cancellation fee to the client's card on file (Pro). Ignored unless the
  // status is CANCELLED and a card + fee are in place.
  chargeCancellationFee: z.boolean().optional(),
});

export const UpdateAppointmentSchema = z.object({
  startsAt: z.string().datetime().optional(),
  clientName: z.string().min(1).optional(),
  clientEmail: z.string().email().optional(),
  clientPhone: z.string().optional(),
  notes: z.string().optional(),
  notifyClient: z.boolean().default(true),
});

// The unauthenticated client "manage" page may ONLY cancel — never confirm /
// complete / no-show (which are owner actions). Keeps the public endpoint from
// being used to bypass the approval flow or fake completions.
export const PublicStatusSchema = z.object({
  status: z.literal('CANCELLED'),
  cancelReason: z.string().optional(),
});

export const LateCancelRequestSchema = z.object({
  cancelReason: z.string().max(1000).optional(),
});

export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>;
export type CreateRecurringDto = z.infer<typeof CreateRecurringSchema>;
export type RescheduleDto = z.infer<typeof RescheduleSchema>;
export type StatusDto = z.infer<typeof StatusSchema>;
export type PublicStatusDto = z.infer<typeof PublicStatusSchema>;
export type LateCancelRequestDto = z.infer<typeof LateCancelRequestSchema>;
export type UpdateAppointmentDto = z.infer<typeof UpdateAppointmentSchema>;
