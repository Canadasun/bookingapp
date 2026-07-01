-- Public booking language defaults. Branches inherit the business setting when
-- defaultLocale is NULL.
ALTER TABLE "Business" ADD COLUMN "defaultLocale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Location" ADD COLUMN "defaultLocale" TEXT;
