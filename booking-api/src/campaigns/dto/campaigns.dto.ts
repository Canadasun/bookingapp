import { z } from 'zod';

export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(120),
  channel: z.enum(['EMAIL', 'SMS']).default('EMAIL'),
  audience: z.enum(['ALL', 'RECENT', 'LAPSED']).default('ALL'),
  subject: z.string().max(160).optional(),
  body: z.string().min(1).max(2000),
}).refine((d) => d.channel !== 'EMAIL' || (d.subject && d.subject.trim().length > 0), {
  message: 'Email campaigns need a subject',
  path: ['subject'],
});
export type CreateCampaignDto = z.infer<typeof CreateCampaignSchema>;

export const UpdateCampaignSchema = CreateCampaignSchema.innerType().partial();
export type UpdateCampaignDto = z.infer<typeof UpdateCampaignSchema>;
