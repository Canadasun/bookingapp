-- Per-location booking URLs: a URL-safe branch slug, unique within a business.
-- Nullable so this is an additive, backfill-safe migration; the API backfills
-- existing rows on boot (LocationsService.onModuleInit). Postgres treats NULLs
-- as distinct, so the unique index coexists with un-backfilled rows.
ALTER TABLE "Location" ADD COLUMN "slug" TEXT;

CREATE UNIQUE INDEX "Location_businessId_slug_key" ON "Location"("businessId", "slug");
