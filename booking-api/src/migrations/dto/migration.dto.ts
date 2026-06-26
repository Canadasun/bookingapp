import { z } from 'zod';

export const MIGRATION_PLATFORMS = [
  'square-appointments',
  'jane-app',
  'vagaro',
  'acuity-scheduling',
  'calendly',
  'fresha',
  'glossgenius',
  'mindbody',
  'setmore',
  'google-contacts',
  'phone-contacts',
  'csv',
  'other',
  'starting-fresh',
] as const;

export const MigrationModeSchema = z.enum(['SELF_SERVICE', 'DONE_FOR_YOU', 'ASSISTED_CALL']);

export const CreateMigrationRequestSchema = z.object({
  sourcePlatform: z.enum(MIGRATION_PLATFORMS),
  mode: MigrationModeSchema.default('SELF_SERVICE'),
  approximateSize: z.number().int().min(0).max(500_000).optional(),
  requestedHelp: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
});

const MigrationPreviewRowSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
}).passthrough();

export const StageMigrationRowsSchema = z.object({
  sourcePlatform: z.enum(MIGRATION_PLATFORMS).optional(),
  fileName: z.string().trim().max(200).optional(),
  rows: z.array(MigrationPreviewRowSchema).min(1).max(1000),
});

export const ConfirmMigrationImportSchema = z.object({
  importValidOnly: z.boolean().default(true),
});

export type CreateMigrationRequestDto = z.infer<typeof CreateMigrationRequestSchema>;
export type StageMigrationRowsDto = z.infer<typeof StageMigrationRowsSchema>;
export type ConfirmMigrationImportDto = z.infer<typeof ConfirmMigrationImportSchema>;
