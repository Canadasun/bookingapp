-- Remove all known seed/demo accounts created by seed.ts, seed-prod.ts, and seed_admin.js.
-- This migration is idempotent (DELETE WHERE has no effect if the rows don't exist).
-- NOTE: pmayeni1@icloud.com was originally listed here by mistake — it is the real
-- production admin account and must NOT be deleted.

-- 1. Seed user accounts only (cascade on FK removes related sessions/devices)
DELETE FROM "User"
WHERE email IN (
  'owner@demo-salon.com',
  'stylist@demo-salon.com'
);

-- 2. Dependent rows for the demo-salon business (ordered by FK depth)
DELETE FROM "StaffService"
WHERE "staffId" IN (
  SELECT s.id FROM "Staff" s
  JOIN "Business" b ON b.id = s."businessId"
  WHERE b.slug = 'demo-salon'
);

DELETE FROM "AvailabilityRule"
WHERE "staffId" IN (
  SELECT s.id FROM "Staff" s
  JOIN "Business" b ON b.id = s."businessId"
  WHERE b.slug = 'demo-salon'
);

DELETE FROM "Staff"
WHERE "businessId" IN (SELECT id FROM "Business" WHERE slug = 'demo-salon');

DELETE FROM "Service"
WHERE "businessId" IN (SELECT id FROM "Business" WHERE slug = 'demo-salon');

-- 3. The demo business itself (only if no real users remain under it)
DO $$
DECLARE
  biz_id TEXT;
  real_user_count INT;
BEGIN
  SELECT id INTO biz_id FROM "Business" WHERE slug = 'demo-salon';
  IF biz_id IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO real_user_count
  FROM "User"
  WHERE "businessId" = biz_id
    AND email NOT IN ('owner@demo-salon.com', 'stylist@demo-salon.com');

  IF real_user_count > 0 THEN
    RAISE NOTICE 'demo-salon has % non-seed user(s) — skipping business deletion', real_user_count;
  ELSE
    DELETE FROM "Business" WHERE id = biz_id;
    RAISE NOTICE 'demo-salon business removed';
  END IF;
END $$;

-- 4. Sample transactions inserted by seed_admin.js (no real provider charge ID)
DELETE FROM "Transaction"
WHERE type IN ('SUBSCRIPTION', 'COMMISSION')
  AND provider = 'STRIPE'
  AND "providerId" IS NULL;
