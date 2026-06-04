-- Sole-proprietor default: every business needs at least one ACTIVE provider so
-- the booking flow works even when the owner never manages "staff". Where a
-- business has no active provider, make the owner one. Idempotent.

-- 1) Reactivate the owner's existing (deactivated) provider record.
UPDATE "Staff" s
SET "active" = true, "updatedAt" = now()
FROM "User" u
WHERE s."userId" = u."id"
  AND u."role" = 'OWNER'
  AND s."active" = false
  AND NOT EXISTS (
    SELECT 1 FROM "Staff" s2 WHERE s2."businessId" = s."businessId" AND s2."active" = true
  );

-- 2) Create an owner provider where the business still has no active provider and
--    the owner has no provider record at all.
INSERT INTO "Staff" ("id", "userId", "businessId", "active", "createdAt", "updatedAt")
SELECT 'sp' || substr(md5(random()::text || clock_timestamp()::text || b."id"), 1, 23),
       u."id", b."id", true, now(), now()
FROM "Business" b
JOIN LATERAL (
  SELECT "id" FROM "User"
  WHERE "businessId" = b."id" AND "role" = 'OWNER'
  ORDER BY "createdAt" ASC
  LIMIT 1
) u ON true
WHERE NOT EXISTS (SELECT 1 FROM "Staff" s WHERE s."businessId" = b."id" AND s."active" = true)
  AND NOT EXISTS (SELECT 1 FROM "Staff" s2 WHERE s2."userId" = u."id");
