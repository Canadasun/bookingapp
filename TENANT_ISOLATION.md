# Tenant Isolation Control

Pulse currently enforces tenant isolation in the NestJS/Prisma application layer.

## Production control

- Authenticated business routes must compare the authenticated user's `businessId` with the route `businessId` before calling the service layer.
- Service-layer reads and writes for tenant-owned records must include `businessId` in Prisma `where` clauses.
- Public appointment management routes require an HMAC manage token, so an appointment id alone is not enough to read or change a booking.
- Public booking creation is intentionally unauthenticated, but it is scoped to the route business and revalidates staff, service, availability, and conflicts server-side.
- Payment ledger, refunds, no-show fees, and custom charges use the authenticated user's business context rather than accepting a request-controlled business id.

## Why PostgreSQL RLS is not enabled in this release

PostgreSQL Row-Level Security requires every application query to run with a reliable per-request tenant context in the database session. Prisma connection pooling can reuse sessions across requests, so enabling RLS without a complete transaction/session context design can cause incorrect denials or, worse, stale tenant context.

For this release, the accepted control is application-layer scoping plus automated cross-tenant tests. Before enabling RLS, add a database tenant context helper, wrap tenant-scoped operations in transactions that set the context locally, and verify every background job and public endpoint has an explicit context strategy.

## Required tests

Before production deploy, run:

```bash
cd booking-api
npm test -- --runInBand
```

The test suite includes controller-boundary checks that reject cross-business access before sensitive service methods execute.
