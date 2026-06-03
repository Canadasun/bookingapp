-- Capture the Stripe-hosted receipt URL on each payment (set on payment_intent.succeeded).
ALTER TABLE "Payment" ADD COLUMN "receiptUrl" TEXT;
