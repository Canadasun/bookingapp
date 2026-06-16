import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(1024),
  // Public self-signup is restricted to business owners and clients only.
  // STAFF are created by an owner via the staff-invite endpoint; ADMIN via seed.
  role: z.enum(['OWNER', 'CLIENT']).default('CLIENT'),
  // OWNER signup only — brand the new business and its demo examples. All
  // optional; falls back to "<name>'s Business" / America/New_York when omitted.
  businessName: z.string().trim().min(1).max(120).optional(),
  businessPhone: z.string().trim().min(3).max(20).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  privacyConsentAccepted: z.literal(true),
  marketingConsent: z.boolean().default(false),
  trackingConsent: z.boolean().default(false),
  consentVersion: z.string().trim().min(1).max(40).default('2026-06-13'),
});

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(1024),
  // Trusted-device token from a prior "remember this device" — lets a 2FA user
  // skip the OTP on a known device.
  trustedDeviceToken: z.string().optional(),
  // Caller declares its surface so the API can enforce platform-specific rules
  // (e.g. admin accounts are blocked on mobile).
  platform: z.enum(['web', 'mobile']).optional(),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(8).max(1024),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(1024),
});

export const VerifyTwoFactorSchema = z.object({
  challengeId: z.string().min(1),
  // Accepts either the 6-digit OTP or an 11-char recovery code ("xxxxx-xxxxx").
  code: z.string().trim().min(4).max(32),
  // "Remember this device" — skip 2FA on this device for future logins.
  rememberDevice: z.boolean().optional(),
});

export const SetTwoFactorSchema = z.object({
  enabled: z.boolean(),
  method: z.enum(['EMAIL', 'SMS']).optional(),
  currentPassword: z.string().min(1),
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type VerifyTwoFactorDto = z.infer<typeof VerifyTwoFactorSchema>;
export type SetTwoFactorDto = z.infer<typeof SetTwoFactorSchema>;
export type VerifyEmailDto = z.infer<typeof VerifyEmailSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type RefreshDto = z.infer<typeof RefreshSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
