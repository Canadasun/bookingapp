import { z } from 'zod';

const DateOnlySchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Invalid calendar date');

export const GetSlotsSchema = z.object({
  staffId: z.string().min(1),
  serviceId: z.string().min(1),
  additionalServiceIds: z.preprocess((value) => {
    if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
    return value;
  }, z.array(z.string().min(1)).max(10).optional()),
  startDate: DateOnlySchema,
  endDate: DateOnlySchema,
  timezone: z.string().trim().min(1).max(64).default('UTC').refine((value) => {
    try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; }
    catch { return false; }
  }, 'Invalid timezone'),
  // Public callers enforce the business's min-notice window; owner/staff tools
  // pass enforceNotice=false to also see near-term slots (their manual bookings
  // override min-notice). Past slots are ALWAYS hidden either way.
  enforceNotice: z.enum(['true', 'false']).optional(),
}).superRefine((value, ctx) => {
  const start = new Date(`${value.startDate}T00:00:00Z`);
  const end = new Date(`${value.endDate}T00:00:00Z`);
  if (end < start) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'endDate must be on or after startDate' });
  } else if ((end.getTime() - start.getTime()) / 86_400_000 > 62) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Availability range cannot exceed 62 days' });
  }
});

export type GetSlotsDto = z.infer<typeof GetSlotsSchema>;

export interface TimeSlot {
  startsAt: Date;
  endsAt: Date;
  startsAtLocal: string;
  endsAtLocal: string;
}
