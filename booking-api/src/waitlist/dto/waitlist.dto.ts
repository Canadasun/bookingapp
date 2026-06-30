import { z } from 'zod';

export const JoinWaitlistSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  serviceId: z.string().optional(),
  staffId: z.string().optional(),
  desiredDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  locale: z.enum(['en', 'fr']).default('en'),
});
export type JoinWaitlistDto = z.input<typeof JoinWaitlistSchema>;
