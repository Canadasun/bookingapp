import { z } from 'zod';

export const SubmitReviewSchema = z.object({
  appointmentId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});
export type SubmitReviewDto = z.infer<typeof SubmitReviewSchema>;

export const ModerateReviewSchema = z.object({ published: z.boolean() });
export type ModerateReviewDto = z.infer<typeof ModerateReviewSchema>;
