-- Make passwordHash nullable so SSO users have no password set
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- OAuth provider columns for Google/Apple sign-in
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "oauthProvider" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "oauthSubject"  TEXT NOT NULL DEFAULT '';

-- Partial unique index: only enforce uniqueness when a provider is actually set
CREATE UNIQUE INDEX IF NOT EXISTS "users_oauth_unique_idx"
    ON "User" ("oauthProvider", "oauthSubject")
    WHERE "oauthProvider" <> '';
