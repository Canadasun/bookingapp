import { z } from 'zod';

export const CreateStaffSchema = z.object({
  userId: z.string().min(1),
  bio: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export const STAFF_PERMISSIONS = ['VIEW_MONEY', 'MANAGE_SERVICES', 'MANAGE_STAFF'] as const;

export const UpdateStaffSchema = z.object({
  bio: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  active: z.boolean().optional(),
  permissions: z.array(z.enum(STAFF_PERMISSIONS)).max(10).optional(),
});
export type UpdateStaffDto = z.infer<typeof UpdateStaffSchema>;

export const AvailabilityRuleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const TimeOffSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().optional(),
});

export const AssignServicesSchema = z.object({
  serviceIds: z.array(z.string().min(1)),
});

export const InviteStaffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  bio: z.string().optional(),
  serviceIds: z.array(z.string().min(1)).optional(),
});

export type CreateStaffDto = z.infer<typeof CreateStaffSchema>;
export type AvailabilityRuleDto = z.infer<typeof AvailabilityRuleSchema>;
export type TimeOffDto = z.infer<typeof TimeOffSchema>;
export type AssignServicesDto = z.infer<typeof AssignServicesSchema>;
export type InviteStaffDto = z.infer<typeof InviteStaffSchema>;
