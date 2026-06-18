import { z } from 'zod';

export const SubmitReviewSchema = z.object({
  appointmentId: z.string().min(1).max(100),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  // Signed manage token from the review-request email link (proves the link came
  // from us — only the appointment's client can have received it).
  token: z.string().min(1).max(200),
});
export type SubmitReviewDto = z.infer<typeof SubmitReviewSchema>;

export const ModerateReviewSchema = z.object({ published: z.boolean() });
export type ModerateReviewDto = z.infer<typeof ModerateReviewSchema>;
