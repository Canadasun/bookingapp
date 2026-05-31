import { z } from 'zod';

export const CreateBusinessSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  phone: z.string().optional(),
  timezone: z.string().default('America/New_York'),
  address: z.string().optional(),
  bookingPageSettings: z.record(z.unknown()).optional(),
  minNoticeMinutes: z.number().int().nonnegative().default(120),
  maxAdvanceDays: z.number().int().positive().default(60),
  cancellationWindowHours: z.number().int().nonnegative().default(24),
  requireDeposit: z.boolean().default(false),
  depositPercent: z.number().int().min(0).max(100).default(25),
  noShowFeeCents: z.number().int().nonnegative().default(0),
  allowClientReschedule: z.boolean().default(true),
  cancellationPolicy: z.string().optional(),
  plan: z.enum(['FREE', 'BASIC', 'PRO']).optional(),
});

export const UpdateBusinessSchema = CreateBusinessSchema.partial();

export type CreateBusinessDto = z.infer<typeof CreateBusinessSchema>;
export type UpdateBusinessDto = z.infer<typeof UpdateBusinessSchema>;
