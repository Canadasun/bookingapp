import { z } from 'zod';

export const IssueGiftCardSchema = z.object({
  amountCents: z.number().int().min(100).max(10_000_00), // $1 – $10,000
  recipientName: z.string().max(120).optional(),
  recipientEmail: z.string().email().optional(),
  purchaserName: z.string().max(120).optional(),
  message: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});
export type IssueGiftCardDto = z.infer<typeof IssueGiftCardSchema>;

export const RedeemGiftCardSchema = z.object({
  code: z.string().min(1).max(32),
  amountCents: z.number().int().min(1).max(10_000_00),
  appointmentId: z.string().optional(),
});
export type RedeemGiftCardDto = z.infer<typeof RedeemGiftCardSchema>;
