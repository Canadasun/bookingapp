-- Group/class bookings: a service slot can hold up to `capacity` clients.
ALTER TABLE "Service" ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 1;
