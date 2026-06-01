import { z } from 'zod';

export const JoinWaitlistSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  serviceId: z.string().optional(),
  staffId: z.string().optional(),
  desiredDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});
export type JoinWaitlistDto = z.infer<typeof JoinWaitlistSchema>;
