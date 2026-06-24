-- Add method column to LoginEvent to track how the user authenticated
ALTER TABLE "LoginEvent" ADD COLUMN "method" TEXT NOT NULL DEFAULT 'PASSWORD';
