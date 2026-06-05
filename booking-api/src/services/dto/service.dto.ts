import { z } from 'zod';

export const CreateServiceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  durationMinutes: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
  bufferBeforeMin: z.number().int().nonnegative().default(0),
  bufferAfterMin: z.number().int().nonnegative().default(0),
  capacity: z.number().int().min(1).max(100).default(1),
  color: z.string().default('#E9A23C'),
  sortOrder: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
  categoryId: z.string().nullable().optional(),
});

export const UpdateServiceSchema = CreateServiceSchema.partial();

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().optional(),
  color: z.string().default('#E9A23C'),
  sortOrder: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

export type CreateServiceDto = z.infer<typeof CreateServiceSchema>;
export type UpdateServiceDto = z.infer<typeof UpdateServiceSchema>;
export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;
