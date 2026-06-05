import { z } from 'zod';
import { normalizePhone } from '../../common/util/phone';

// A complete name: at least 2 characters and containing an actual letter
// (rejects "  ", "12", "--").
const nameSchema = z
  .string()
  .trim()
  .min(2, 'Enter the full name')
  .refine((v) => /\p{L}/u.test(v), 'Enter a valid name');

// Optional phone, normalized to E.164. Empty → omitted; anything present must be
// a complete, valid number (so Twilio can actually deliver SMS).
const phoneSchema = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const normalized = normalizePhone(v);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid phone number, e.g. +1 555 123 4567' });
      return z.NEVER;
    }
    return normalized;
  });

export const CreateClientSchema = z.object({
  name: nameSchema,
  email: z.string().trim().toLowerCase().email(),
  phone: phoneSchema,
  notes: z.string().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export const UpdateClientSchema = CreateClientSchema.partial();

// Merge duplicates into one primary; the owner picks the canonical name/email/phone.
export const MergeClientsSchema = z.object({
  primaryId: z.string().min(1),
  dupeIds: z.array(z.string().min(1)).min(1).max(20),
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().optional().nullable(),
});

export type CreateClientDto = z.infer<typeof CreateClientSchema>;
export type UpdateClientDto = z.infer<typeof UpdateClientSchema>;
export type MergeClientsDto = z.infer<typeof MergeClientsSchema>;
