import { z } from 'zod';
import { normalizePhone } from '../../common/util/phone';

// Optional phone normalized to E.164 (so Twilio can deliver SMS to the owner).
// A bare 10-digit number is treated as +1; anything present must be complete.
const phoneSchema = z
  .preprocess((v) => v === null ? undefined : v, z.string().trim().optional())
  .transform((v, ctx) => {
    if (!v) return undefined;
    const normalized = normalizePhone(v);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid phone number, e.g. +1 555 123 4567' });
      return z.NEVER;
    }
    return normalized;
  });

const optionalString = (max?: number) => z.preprocess(
  (v) => v === null ? undefined : v,
  (max ? z.string().max(max) : z.string()).optional(),
);

export const CreateBusinessSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  phone: phoneSchema,
  timezone: z.string().default('America/New_York'),
  address: optionalString(),
  logoUrl: optionalString(2048),
  bookingPageSettings: z.record(z.unknown()).optional(),
  minNoticeMinutes: z.number().int().nonnegative().default(120),
  maxAdvanceDays: z.number().int().positive().default(60),
  cancellationWindowHours: z.number().int().nonnegative().default(24),
  requireDeposit: z.boolean().default(false),
  depositPercent: z.number().int().min(1).max(100).default(25),
  noShowFeeCents: z.number().int().nonnegative().default(0),
  cancellationFeeCents: z.number().int().nonnegative().default(0),
  allowClientReschedule: z.boolean().default(true),
  cancellationPolicy: optionalString(),
  plan: z.enum(['FREE', 'BASIC', 'PRO']).optional(),
});

export const UpdateBusinessSchema = CreateBusinessSchema.partial();

export type CreateBusinessDto = z.infer<typeof CreateBusinessSchema>;
export type UpdateBusinessDto = z.infer<typeof UpdateBusinessSchema>;
