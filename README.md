# BookingApp

A Square Appointments–style booking core: business profiles, staff scheduling, conflict-safe appointment booking, notifications, and Stripe deposit/no-show fees.

## Architecture

```
Bookingapp/
├── booking-api/     NestJS + Prisma + PostgreSQL + Redis/BullMQ
├── booking-web/     Next.js 15 + Tailwind — public booking flow + dashboard
├── booking-mobile/  Expo React Native — client login + appointment list
└── docker-compose.yml
```

### booking-api module map

| Module | Responsibility |
|---|---|
| `AuthModule` | JWT login/register/refresh, role guards (OWNER / STAFF / CLIENT) |
| `BusinessModule` | Business CRUD, booking-page settings |
| `StaffModule` | Staff CRUD, assign services, availability rules, time-off |
| `ServiceModule` | Service CRUD (duration, price, buffers) |
| `AvailabilityModule` | `GET /availability/slots` — slots engine with buffer & time-off subtraction, DST-safe via `date-fns-tz` |
| `AppointmentModule` | Create/confirm/reschedule/cancel with SERIALIZABLE `SELECT FOR UPDATE` — exactly-once booking under concurrency |
| `ClientModule` | Client CRUD, search by email/phone, appointment history |
| `NotificationModule` | BullMQ queues: confirmation email, 24h reminder email, 2h reminder SMS, cancellation email (Resend + Twilio stubs) |
| `PaymentModule` | Stripe deposit intent, no-show fee charge, idempotent webhook handler |
| `HealthModule` | `GET /api/healthz` — DB + Redis ping |

---

## Prerequisites

- Node 20+
- Docker (for postgres + redis) **or** a local PostgreSQL 16+ and Redis 7+

---

## Run everything with Docker

```bash
# From Bookingapp/
docker compose up --build

# In a separate terminal after containers are healthy:
cd booking-api
npm run prisma:migrate:prod  # applies migrations
npm run seed                 # loads demo data
```

API → http://localhost:3001  
Swagger → http://localhost:3001/docs

---

## Run locally (without Docker)

### 1. Start database & cache

```bash
# Postgres must be running and accessible
psql postgres -c "CREATE USER bookingapp WITH PASSWORD 'bookingapp' CREATEDB;"
psql postgres -c "CREATE DATABASE bookingapp OWNER bookingapp;"

# Redis (brew)
brew services start redis
```

### 2. booking-api

```bash
cd booking-api
cp .env.example .env          # fill in secrets
npm install
npm run prisma:migrate        # creates tables
npm run prisma:generate       # regenerates client (already done on install)
npm run seed                  # loads demo data
npm run start:dev             # http://localhost:3001
```

### 3. booking-web

```bash
cd booking-web
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_BUSINESS_ID
npm install
npm run dev                         # http://localhost:3000
```

Routes:
- `/book/[businessId]` — public 6-step booking flow
- `/dashboard` — owner/staff login + appointment management

### 4. booking-mobile

```bash
cd booking-mobile
npm install
npx expo start            # scan QR with Expo Go
```

Set `EXPO_PUBLIC_BUSINESS_ID` in a `.env` file or in `app.json` under `extra`.

---

## Run tests

```bash
cd booking-api

# AvailabilityModule — 12 unit tests (basic, conflicts, time-off, buffers, DST)
npx jest src/availability/availability.service.spec.ts

# AppointmentModule — 6 unit tests including 50-concurrent-request concurrency test
npx jest src/appointment/appointment.service.spec.ts

# All tests with coverage
npm run test:cov
```

---

## Demo credentials (after seed)

| Role | Email | Password |
|---|---|---|
| Owner | owner@demo-salon.com | password123 |
| Staff (Bob) | bob@demo-salon.com | password123 |
| Staff (Sara) | sara@demo-salon.com | password123 |

---

## Environment variables

See `booking-api/.env.example` for all variables. Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection URL |
| `JWT_SECRET` | Access token signing key |
| `JWT_REFRESH_SECRET` | Refresh token signing key |
| `STRIPE_SECRET_KEY` | Stripe API key (set `sk_test_...` for dev) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature secret |
| `RESEND_API_KEY` | Resend email API key |
| `TWILIO_ACCOUNT_SID` | Twilio SID for SMS |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM_NUMBER` | Twilio sender phone number |

Email and SMS providers are interface-backed stubs — they log to console until real keys are provided.

---

## Notable design decisions

**Double-booking prevention**: `AppointmentService.create` runs inside a Prisma `$transaction` with `SERIALIZABLE` isolation and issues a `SELECT ... FOR UPDATE` against overlapping appointments before inserting. This means the row lock is held for the duration of the transaction — concurrent requests serialise and only one succeeds. Verified by a 50-parallel-request unit test.

**Availability slots**: `AvailabilityService.getAvailableSlots` converts rule times from business timezone to UTC using `date-fns-tz/fromZonedTime`, then returns slots in the caller's requested timezone. DST transitions are handled transparently because all arithmetic happens in UTC.

**Notification jobs**: BullMQ jobs are keyed by `reminder-24h-{appointmentId}` / `reminder-2h-{appointmentId}` so cancellation/reschedule can remove them by job ID without scanning the queue.

**Optional services**: Stripe, Resend, and Twilio are guarded by placeholder checks — the app boots and runs without real keys (providers log to console instead of calling APIs).
