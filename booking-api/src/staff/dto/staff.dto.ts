import { z } from 'zod';

const INTERNAL_UPLOAD = /^\/(?:proxy\/)?uploads\/[a-zA-Z0-9_-]+$/;
const avatarUrlSchema = z.string().max(2048).refine((v) => {
  if (INTERNAL_UPLOAD.test(v)) return true;
  try { return new URL(v).protocol === 'https:'; } catch { return false; }
}, 'avatarUrl must be an https:// URL or an internal /uploads/ path').optional();

export const CreateStaffSchema = z.object({
  userId: z.string().min(1),
  bio: z.string().max(1000).optional(),
  avatarUrl: avatarUrlSchema,
});

export const STAFF_PERMISSIONS = ['VIEW_MONEY', 'MANAGE_SERVICES', 'MANAGE_STAFF'] as const;

export const UpdateStaffSchema = z.object({
  bio: z.string().max(1000).optional(),
  avatarUrl: avatarUrlSchema,
  active: z.boolean().optional(),
  permissions: z.array(z.enum(STAFF_PERMISSIONS)).max(10).optional(),
  // Primary/home branch (kept for backward compatibility).
  locationId: z.string().nullable().optional(),
  // Full set of branches this provider works at (multi-location). When present,
  // it is the source of truth and the primary is derived from it.
  locationIds: z.array(z.string().min(1)).max(50).optional(),
});
export type UpdateStaffDto = z.infer<typeof UpdateStaffSchema>;

export const AvailabilityRuleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
}).refine((value) => value.endTime > value.startTime, {
  path: ['endTime'],
  message: 'endTime must be after startTime',
});

export const TimeOffSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().max(500).optional(),
}).refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
  path: ['endsAt'],
  message: 'endsAt must be after startsAt',
});

export const AssignServicesSchema = z.object({
  serviceIds: z.array(z.string().min(1)).max(50),
});

export const InviteStaffSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  bio: z.string().max(1000).optional(),
  serviceIds: z.array(z.string().min(1)).max(50).optional(),
});

export type CreateStaffDto = z.infer<typeof CreateStaffSchema>;
export type AvailabilityRuleDto = z.infer<typeof AvailabilityRuleSchema>;
export type TimeOffDto = z.infer<typeof TimeOffSchema>;
export type AssignServicesDto = z.infer<typeof AssignServicesSchema>;
export type InviteStaffDto = z.infer<typeof InviteStaffSchema>;
