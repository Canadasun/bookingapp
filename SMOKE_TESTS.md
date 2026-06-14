# BookingApp Smoke Tests

Run this checklist in a real browser and on a mobile build before each public deploy.

## Environment

- API is reachable at `/api/healthz`.
- Web is reachable at `/api/health`.
- Web `API_INTERNAL_URL` points to the API origin.
- Mobile `EXPO_PUBLIC_API_BASE` points to the API origin plus `/api`.
- Stripe webhook endpoint is configured with the same deployed API URL.

## Web Owner Flow

1. Register a new owner account from `/register`.
2. Confirm the owner lands in `/dashboard`.
3. Create one service and one active staff member.
4. Set staff availability for today or tomorrow.
5. Open `/book/{businessSlug}` in a private window.
6. Book an appointment as a new client.
7. Confirm the owner dashboard shows a pending booking.
8. Confirm the top-bar notification bell shows an unread badge.
9. Open `/dashboard/notifications`, filter by new bookings, and mark the alert read.
10. Open delivery logs and confirm email/SMS attempts are visible after notifications send.

## Booking Operations

1. Confirm the pending appointment.
2. Reschedule it from the owner dashboard.
3. Cancel one test appointment and confirm notification/reminder cancellation.
4. Mark one appointment completed and confirm review request behavior.
5. Mark one appointment no-show and confirm the fee behavior matches the business settings.

## Messaging

1. From the client manage page, send a message to the business.
2. Confirm `/dashboard/messages` shows the unread conversation.
3. Reply as owner on a paid plan.
4. Confirm the client portal shows the owner reply.
5. Confirm the mobile app Alerts and Messages tabs reflect the update.

## Payments

1. Run one deposit-required booking using Stripe test cards.
2. Confirm frontend never marks payment successful without webhook confirmation.
3. Confirm payment ledger shows succeeded, failed, and refunded states correctly.
4. Run a refund from the dashboard and verify Stripe/dashboard totals.

## Subscriptions

1. Upgrade a Free business through Stripe Checkout.
2. Confirm the returning Billing page verifies the Checkout Session and shows the paid plan without a manual refresh.
3. Confirm Billing shows automatic renewal and the next billing date.
4. Schedule cancellation in Stripe Billing Portal and confirm the app shows access through the current period end.
5. Confirm `checkout.session.completed` and `customer.subscription.*` deliveries succeed in Stripe.

## Mobile

1. Sign in as the same owner.
2. Confirm Calendar, Checkout, Customers, Messages, Alerts, and Menu load.
3. Confirm Alerts can mark one notification read.
4. Confirm weak-network behavior shows an error without crashing.

## Production Gates

- Backend tests pass.
- Backend build passes.
- Web build passes.
- Web lint passes.
- Mobile TypeScript check passes.
- Mobile export or native build passes.
- No test/demo credentials are exposed in public docs or deployed env.
