import { z } from 'zod';

// Package product (template) the owner defines.
export const CreatePackageSchema = z.object({
  name: z.string().min(1).max(120),
  serviceId: z.string().optional(),
  credits: z.number().int().min(1).max(100),
  priceCents: z.number().int().min(0).max(10_000_00),
  active: z.boolean().optional(),
});
export type CreatePackageDto = z.infer<typeof CreatePackageSchema>;

export const UpdatePackageSchema = CreatePackageSchema.partial();
export type UpdatePackageDto = z.infer<typeof UpdatePackageSchema>;

// Issue a package to a client. Either from a template (packageId) or ad-hoc.
export const IssueClientPackageSchema = z.object({
  clientId: z.string().min(1),
  packageId: z.string().optional(),
  name: z.string().max(120).optional(),
  serviceId: z.string().optional(),
  credits: z.number().int().min(1).max(100).optional(),
  expiresAt: z.string().datetime().optional(),
}).refine((d) => !!d.packageId || (!!d.name && !!d.credits), {
  message: 'Provide a packageId, or a name + credits for an ad-hoc package',
  path: ['packageId'],
});
export type IssueClientPackageDto = z.infer<typeof IssueClientPackageSchema>;

export const RedeemClientPackageSchema = z.object({
  appointmentId: z.string().optional(),
});
export type RedeemClientPackageDto = z.infer<typeof RedeemClientPackageSchema>;
