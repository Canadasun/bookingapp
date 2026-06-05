-- Per-business display + charge currency. Defaults to CAD.
ALTER TABLE "Business" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'CAD';
