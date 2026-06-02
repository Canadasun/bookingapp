import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  // Public self-signup is restricted to business owners and clients only.
  // STAFF are created by an owner via the staff-invite endpoint; ADMIN via seed.
  role: z.enum(['OWNER', 'CLIENT']).default('CLIENT'),
  businessId: z.string().cuid().optional(),
  // OWNER signup only — brand the new (empty) business. All optional; falls back
  // to "<name>'s Business" / America/New_York when omitted.
  businessName: z.string().min(1).max(120).optional(),
  businessPhone: z.string().min(3).max(20).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type RefreshDto = z.infer<typeof RefreshSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
