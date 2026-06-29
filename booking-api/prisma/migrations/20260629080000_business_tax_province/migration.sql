-- Remember which Canadian province/territory a business's tax rate preset came
-- from, so the settings UI can show it and future itemized tax can use it.
-- Nullable add — instant, no table rewrite.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "taxProvince" TEXT;
