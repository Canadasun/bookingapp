-- Opt-in: ask every booking client to put a card on file with Stripe (no upfront
-- charge) so the business can collect deposits/no-show/late-cancel fees later.
ALTER TABLE "Business" ADD COLUMN "collectCardOnFile" BOOLEAN NOT NULL DEFAULT false;
