-- Email verification: gates the client portal so email-matched lookups are only
-- trusted once the user proves they own the address.
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
