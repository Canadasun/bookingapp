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

const optionalHttpsUrl = z.preprocess(
  (v) => v === '' || v === null ? undefined : v,
  z.string().url().max(2048).refine((v) => new URL(v).protocol === 'https:', 'Use an https:// URL').optional(),
);

export const CreateBusinessSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  phone: phoneSchema,
  timezone: z.string().default('America/New_York'),
  address: optionalString(500),
  logoUrl: optionalHttpsUrl,
  websiteUrl: optionalHttpsUrl,
  instagramUrl: optionalHttpsUrl,
  facebookUrl: optionalHttpsUrl,
  tiktokUrl: optionalHttpsUrl,
  postVisitMessage: optionalString(500),
  bookingPageSettings: z.record(z.unknown()).optional(),
  notificationSettings: z.record(z.unknown()).optional(),
  intakeQuestions: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1).max(200),
    required: z.boolean().optional(),
  })).max(20).optional(),
  taxRatePercent: z.number().min(0).max(100).optional(),
  minNoticeMinutes: z.number().int().nonnegative().default(120),
  maxAdvanceDays: z.number().int().positive().default(60),
  maxAdvanceMinutes: z.number().int().positive().default(86400),
  cancellationWindowHours: z.number().int().nonnegative().default(24),
  cancellationWindowMinutes: z.number().int().nonnegative().default(1440),
  requireDeposit: z.boolean().default(false),
  depositPercent: z.number().int().min(1).max(100).default(25),
  noShowFeeCents: z.number().int().nonnegative().default(0),
  cancellationFeeCents: z.number().int().nonnegative().default(0),
  collectCardOnFile: z.boolean().default(false),
  allowClientReschedule: z.boolean().default(true),
  cancellationPolicy: optionalString(5000),
  currency: z.enum(['CAD', 'USD']).default('CAD'),
  plan: z.enum(['FREE', 'BASIC', 'PRO', 'UNLIMITED']).optional(),
});

// plan is server-controlled (via Stripe or admin); omit it so owners can never
// self-upgrade by sending plan in a PATCH body.
export const UpdateBusinessSchema = CreateBusinessSchema.omit({ plan: true }).partial();

export type CreateBusinessDto = z.infer<typeof CreateBusinessSchema>;
export type UpdateBusinessDto = z.infer<typeof UpdateBusinessSchema>;
