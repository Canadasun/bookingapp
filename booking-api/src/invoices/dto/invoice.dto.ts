import { z } from 'zod';

const LineItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(10_000),
  unitCents: z.number().int().min(0).max(100_000_000),
});

export const CreateInvoiceSchema = z.object({
  clientId: z.string().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  lineItems: z.array(LineItemSchema).min(1).max(50),

  // Professional invoice fields
  taxRatePercent: z.number().min(0).max(100).optional().nullable(),
  discountCents: z.number().int().min(0).max(100_000_000).optional(),
  discountLabel: z.string().max(100).optional().nullable(),
  paymentTerms: z.string().max(500).optional().nullable(),
  poNumber: z.string().max(100).optional().nullable(),
  billingAddress: z.string().max(500).optional().nullable(),
});

export const UpdateInvoiceSchema = z.object({
  clientId: z.string().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  lineItems: z.array(LineItemSchema).min(1).max(50).optional(),

  // Professional invoice fields
  taxRatePercent: z.number().min(0).max(100).optional().nullable(),
  discountCents: z.number().int().min(0).max(100_000_000).optional(),
  discountLabel: z.string().max(100).optional().nullable(),
  paymentTerms: z.string().max(500).optional().nullable(),
  poNumber: z.string().max(100).optional().nullable(),
  billingAddress: z.string().max(500).optional().nullable(),
});

export const UpdateInvoiceStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'VOID']),
});

export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceDto = z.infer<typeof UpdateInvoiceSchema>;
export type UpdateInvoiceStatusDto = z.infer<typeof UpdateInvoiceStatusSchema>;
