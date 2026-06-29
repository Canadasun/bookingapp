-- Global search: typo-tolerant fuzzy matching via pg_trgm.
-- pg_trgm is a "trusted" extension (PG13+), so the database owner can enable it
-- without superuser. Everything here is idempotent and additive.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes back the `%` similarity operator and `ILIKE '%term%'`
-- substring scans on the columns the global search hits most.
CREATE INDEX IF NOT EXISTS "Client_name_trgm_idx"    ON "Client"   USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Client_email_trgm_idx"   ON "Client"   USING gin ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Service_name_trgm_idx"   ON "Service"  USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "User_name_trgm_idx"      ON "User"     USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Location_name_trgm_idx"  ON "Location" USING gin ("name" gin_trgm_ops);
