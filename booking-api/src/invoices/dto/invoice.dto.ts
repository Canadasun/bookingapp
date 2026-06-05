import { z } from 'zod';

export const CreateInvoiceSchema = z.object({
  clientId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional(),
  dueAt: z.string().datetime().optional(),
  lineItems: z.array(z.object({
    description: z.string().trim().min(1).max(200),
    quantity: z.number().int().min(1).max(10_000),
    unitCents: z.number().int().min(0).max(100_000_000),
  })).min(1).max(50),
});

export const UpdateInvoiceStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'VOID']),
});

export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceStatusDto = z.infer<typeof UpdateInvoiceStatusSchema>;
