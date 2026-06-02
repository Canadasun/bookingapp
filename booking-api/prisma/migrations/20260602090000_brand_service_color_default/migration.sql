-- Rebrand: default new service/category colors to the amber brand color.
ALTER TABLE "Service" ALTER COLUMN "color" SET DEFAULT '#E9A23C';
ALTER TABLE "ServiceCategory" ALTER COLUMN "color" SET DEFAULT '#E9A23C';
