-- Late-cancellation fee (distinct from no-show fee), charged to a saved card when
-- a client cancels inside the cancellation window on a paid plan.
ALTER TABLE "Business" ADD COLUMN "cancellationFeeCents" INTEGER NOT NULL DEFAULT 0;
