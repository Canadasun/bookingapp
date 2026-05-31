import { z } from 'zod';

export const GetSlotsSchema = z.object({
  staffId: z.string().min(1),
  serviceId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  timezone: z.string().default('UTC'),
});

export type GetSlotsDto = z.infer<typeof GetSlotsSchema>;

export interface TimeSlot {
  startsAt: Date;
  endsAt: Date;
  startsAtLocal: string;
  endsAtLocal: string;
}
