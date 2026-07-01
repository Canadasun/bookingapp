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

// logoUrl can be an upload path (/proxy/uploads/:id or /uploads/:id) OR an external https URL.
const INTERNAL_UPLOAD_RE = /^\/(?:proxy\/)?uploads\/[a-zA-Z0-9_-]+$/;
const optionalLogoUrl = z.preprocess(
  (v) => v === '' || v === null ? undefined : v,
  z.string().max(2048).refine(
    (v) => INTERNAL_UPLOAD_RE.test(v) || (() => { try { return new URL(v).protocol === 'https:'; } catch { return false; } })(),
    'Use an https:// URL or an internal /uploads/ path',
  ).optional(),
);

export const CreateBusinessSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  phone: phoneSchema,
  timezone: z.string().max(64).default('America/Toronto'),
  defaultLocale: z.enum(['en', 'fr']).default('en'),
  address: optionalString(500),
  logoUrl: optionalLogoUrl,
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
  taxProvince: z.string().trim().max(2).nullable().optional(),
  minNoticeMinutes: z.number().int().nonnegative().max(43_200).default(120),     // max 30 days
  maxAdvanceDays: z.number().int().positive().max(730).default(60),               // max 2 years
  maxAdvanceMinutes: z.number().int().positive().max(1_051_200).default(86400),   // max 2 years
  cancellationWindowHours: z.number().int().nonnegative().max(8_760).default(24), // max 1 year
  cancellationWindowMinutes: z.number().int().nonnegative().max(525_600).default(1440), // max 1 year
  requireDeposit: z.boolean().default(false),
  depositPercent: z.number().int().min(1).max(100).default(25),
  noShowFeeCents: z.number().int().nonnegative().max(100_000_00).default(0),      // max $10,000
  cancellationFeeCents: z.number().int().nonnegative().max(100_000_00).default(0), // max $10,000
  collectCardOnFile: z.boolean().default(false),
  allowClientReschedule: z.boolean().default(true),
  allowClientCancel: z.boolean().default(true),
  bookingApprovalMode: z.enum(['AUTO', 'MANUAL']).default('MANUAL'),
  cancellationPolicy: optionalString(5000),
  currency: z.enum(['CAD', 'USD']).default('CAD'),
  plan: z.enum(['FREE', 'BASIC', 'PRO', 'UNLIMITED']).optional(),
});

// plan is server-controlled (via Stripe or admin); omit it so owners can never
// self-upgrade by sending plan in a PATCH body.
export const UpdateBusinessSchema = CreateBusinessSchema.omit({ plan: true }).partial();

export type CreateBusinessDto = z.infer<typeof CreateBusinessSchema>;
export type UpdateBusinessDto = z.infer<typeof UpdateBusinessSchema>;
