# Phase 1 — Lifecycle Email Engine (Implementation Plan)
**Scope:** close the revenue-critical comms gaps (audit items #5 billing emails, #10 influencer/comp lifecycle) on top of infra that already exists. Backend-heavy, low structural risk, ~zero migration. Report + build reference — grounded in the current code.

## Reused infrastructure (do NOT rebuild)
- BullMQ `notifications` queue + `NotificationProcessor` (`concurrency:1`, rate-limited).
- Enqueue API in `NotificationsService`; repeatable crons registered in `onModuleInit()`.
- `ResendEmailProvider` + `emailWrap(content, unsubscribeUrl?, locale)` — already bilingual EN/FR.
- `NotificationDelivery` table for idempotency/dedupe (2-min duplicate suppression + `ALWAYS_SEND` allowlist).
- `notifyOwners()` → in-app inbox notification + Expo push.
- Stripe webhook `switch` in `payments.service.ts` (`process()`), keyed on Stripe `eventId`.
- Helpers: `fmtMoney`, `fmtDateCa` (en-CA); owners via `user.role === 'OWNER'`.

## Deliverables (each = 1 job handler + 1 EN/FR template)
| # | Email / notice | Trigger | Hook |
|---|---|---|---|
| 1 | First-payment receipt | `invoice.payment_succeeded` where `billing_reason === 'subscription_create'` | `payments.service.ts` `notifySubscriptionInvoicePaid` (currently early-returns) |
| 2 | Card-expiring (30/7-day) | new daily cron `card-expiry-scan` | scan sub default PM `exp_month/exp_year` |
| 3 | Cancellation confirmation | `subscription.updated` w/ `cancel_at_period_end` + `subscription.deleted` | `payments.service.ts:546/559` |
| 4 | Comp-plan welcome | `grantComplimentaryPlan()` success | `verification.service.ts` |
| 5 | Comp-plan expiry countdown (14/7/1-day) | new daily cron `comp-plan-expiry-scan` | new repeatable job |
| 6 | Comp-plan expired ("subscribe to keep access") | inside `expire-complimentary-plans` after revert | `notifications.processor.ts` |

## Idempotency / dedupe
No new columns. Dedupe purely via `NotificationDelivery.type` buckets:
`comp-plan-granted`, `comp-plan-expiring-14/-7/-1`, `comp-plan-expired`, `card-expiring-30/-7`, `first-payment-receipt`, `subscription-cancelled`. Billing emails additionally keyed on Stripe `eventId` (existing pattern).

## Cross-cutting
- All six are transactional (billing/account) → CASL-exempt, but keep daytime UTC scan windows; never batch at night.
- i18n: every template EN+FR via `emailWrap(..., locale)` using owner `user.locale`. (Also retrofit existing `sendSubscription*Email`/`sendPlanChangedEmail`, which are EN-only today.)
- Flags: existing `NOTIFICATIONS_ENABLED` + new `LIFECYCLE_EMAILS_ENABLED` to ship dark.

## PR sequencing
- **PR-A** — Comp-plan lifecycle (#10): welcome + 14/7/1-day countdown + expired email. Wires `NotificationsModule` into `VerificationModule`. *(building first — highest emotional/retention ROI, self-contained)*
- **PR-B** — Billing emails: first-payment receipt, cancellation confirmation, card-expiry scan + billing-portal update-card link.
- **PR-C** — Frontend: comp-countdown banner + PAST_DUE "update card" banner; localize billing emails.

## Risks
- Over-emailing → mitigated by delivery-log dedupe + daytime scans + transactional-only.
- Card-expiry: Stripe `customer.source.expiring` doesn't fire for PaymentMethods → daily PM-expiry scan is the reliable path; cache exp date at `payment_method.attached`.
- Module coupling: adding `NotificationsModule` to `VerificationModule` is clean (Notifications doesn't import Verification → no cycle).

## Testing
Unit specs beside existing `payments.service.spec.ts` / `verification.service.spec.ts` / notifications specs: assert each trigger enqueues once; dedupe suppresses same-day repeat; comp-grant now enqueues welcome. Manual via Stripe CLI triggers + an admin comp grant.
