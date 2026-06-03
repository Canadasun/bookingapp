-- One-time 2FA recovery codes (stored as sha256 hashes). Lets a user who can't
-- receive their email/SMS code still sign in, then disable 2FA.
ALTER TABLE "User" ADD COLUMN "twoFactorRecoveryCodes" TEXT[] NOT NULL DEFAULT '{}';
