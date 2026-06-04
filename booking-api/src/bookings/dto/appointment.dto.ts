import { z } from 'zod';

export const CreateAppointmentSchema = z.object({
  staffId: z.string().min(1),
  serviceId: z.string().min(1),
  additionalServiceIds: z.array(z.string().min(1)).optional(),
  clientId: z.string().min(1),
  startsAt: z.string().datetime(),
  notes: z.string().optional(),
  allowOverride: z.boolean().optional(),
});

export const RescheduleSchema = z.object({
  startsAt: z.string().datetime(),
  staffId: z.string().optional(),
});

export const StatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']),
  cancelReason: z.string().optional(),
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

export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>;
export type RescheduleDto = z.infer<typeof RescheduleSchema>;
export type StatusDto = z.infer<typeof StatusSchema>;
export type PublicStatusDto = z.infer<typeof PublicStatusSchema>;
export type UpdateAppointmentDto = z.infer<typeof UpdateAppointmentSchema>;
