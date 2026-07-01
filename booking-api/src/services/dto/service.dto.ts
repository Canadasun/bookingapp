import { z } from 'zod';

const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a 6-digit hex color');

export const CreateServiceSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  durationMinutes: z.number().int().positive().max(1440),
  priceCents: z.number().int().nonnegative().max(100_000_00),
  priceType: z.enum(['FLAT', 'PER_HOUR', 'STARTING_AT']).default('FLAT'),
  // Delivery mode (see Service.locationMode). VIRTUAL services may carry a
  // default meeting link; kept lenient (not strict URL) since links like
  // "meet.google.com/abc" omit a scheme. Empty/whitespace is normalised to null.
  locationMode: z.enum(['IN_PERSON', 'VIRTUAL', 'CUSTOMER', 'PHONE']).default('IN_PERSON'),
  virtualMeetingUrl: z.string().trim().max(500).optional().nullable()
    .transform((v) => (v ? v : null)),
  bufferBeforeMin: z.number().int().nonnegative().max(480).default(0),
  bufferAfterMin: z.number().int().nonnegative().max(480).default(0),
  capacity: z.number().int().min(1).max(100).default(1),
  resourceId: z.string().nullable().optional(),
  color: HexColorSchema.default('#E9A23C'),
  sortOrder: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
  categoryId: z.string().nullable().optional(),
});

export const UpdateServiceSchema = CreateServiceSchema.partial();

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(2000).optional(),
  color: HexColorSchema.default('#E9A23C'),
  sortOrder: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

export const SetLocationOverridesSchema = z.object({
  overrides: z.array(z.object({
    locationId: z.string().min(1),
    enabled: z.boolean(),
    priceCents: z.number().int().min(0).max(100_000_000).nullable(),
  })).max(100),
});
export type SetLocationOverridesDto = z.infer<typeof SetLocationOverridesSchema>;

export type CreateServiceDto = z.infer<typeof CreateServiceSchema>;
export type UpdateServiceDto = z.infer<typeof UpdateServiceSchema>;
export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;
