-- Granular staff access flags (additive over the base STAFF role).
ALTER TABLE "Staff" ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT '{}';
