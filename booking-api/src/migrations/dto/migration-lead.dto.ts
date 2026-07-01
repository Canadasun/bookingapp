import { z } from 'zod';

// Public concierge-migration form submission from the marketing site (/migrate).
// Field names mirror the existing form payload (business, platform, message).
export const CreateMigrationLeadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  business: z.string().trim().min(1).max(200),
  platform: z.string().trim().min(1).max(100),
  message: z.string().trim().max(2000).optional(),
});
export type CreateMigrationLeadDto = z.infer<typeof CreateMigrationLeadSchema>;

export const UpdateMigrationLeadStatusSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']),
});
export type UpdateMigrationLeadStatusDto = z.infer<typeof UpdateMigrationLeadStatusSchema>;
