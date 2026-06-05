-- Owner-defined labels on clients (VIP, New, etc.).
ALTER TABLE "Client" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';
