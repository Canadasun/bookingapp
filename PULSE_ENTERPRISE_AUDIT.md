# Pulse Appointments — Enterprise Audit Report
**Report-only. No code has been modified.** Prepared for: Owner / idwu1470@gmail.com · Date: 2026-06-30

> Scope: `booking-api` (NestJS + Prisma + Postgres + Redis/BullMQ), `booking-web` (Next.js 15, EN + /fr route groups), `mobile` (Expo). Findings are grounded in the actual code read during this audit; where I could not fully verify something at runtime, it is marked **(unverified)**.

---

## 1. Executive Summary

Pulse is a **genuinely mature, well-architected booking SaaS** — meaningfully ahead of where most pre-$1M products sit. The data model is deep (≈60 Prisma models), the dashboard already uses sensible IA (Catalog / Workflow / Payments / Marketing groups with clickable hub pages plus a ⌘K palette), search is backed by `pg_trgm` trigram similarity, billing handles the full Stripe subscription lifecycle including dunning, and there is real bilingual (EN/fr) infrastructure, SEO scaffolding, and a compliance surface (PIPEDA / CASL / Québec Law 25 / WCAG pages).

The path to $1M ARR is therefore **not a rebuild** — it is closing a focused set of "last 20%" gaps that currently cap conversion, retention, and enterprise credibility:

1. **Lifecycle communications are incomplete** — strong appointment notifications, but billing/promo/comp-plan emails have holes (no card-expiring, no cancellation confirmation, no comp-plan welcome or expiry warning). This silently bleeds revenue and trust.
2. **Multi-location is "scoped" but not "managed separately"** — confirmed by a paying Unlimited customer. Services share one menu/price across branches, staff bind to a single location, and there is no per-location settings hub or booking page. This is the single biggest enterprise/expansion-revenue blocker.
3. **Global search is shallow** — 6 entity types, several imprecise deep-links, no messages/notes/marketing entities.
4. **The public site lacks proof** — no real photography, no product video, no testimonial/trust imagery. The funnel top is weaker than the product.
5. **Discoverability of paid features is thin** — a checklist exists, but no tours, tooltips, or feature-announcement system, so high-value features (memberships, packages, campaigns, waitlist) go unused → lower upgrade rate.

**Enterprise Readiness Score: 72 / 100** (see §17).

---

## 2. Critical Issues

| # | Issue | Severity | Evidence |
|---|---|---|---|
| C1 | **Comp / influencer plan is granted and revoked silently.** `grantComplimentaryPlan` writes the plan + `complimentaryPlanExpiresAt` and an audit log but sends **no** welcome email and **no** in-app notice; the `expire-complimentary-plans` job reverts the plan with only an audit log — **no pre-expiry reminder, no expiry email**. Influencers/VIPs don't know what they got or when they lose it. | Critical (growth) | `verification.service.ts:322`, `notifications.processor.ts:628` |
| C2 | **Multi-location is not truly multi-tenant within a business.** Services are `businessId`-scoped only (no `locationId`) → identical menu and pricing at every branch; staff carry a single `locationId` → a provider can't work at two branches. Directly matches the Unlimited customer complaint. | Critical (expansion revenue) | `schema.prisma` Service model; `Staff.locationId` singular |
| C3 | **Billing email coverage has revenue-critical gaps.** Present: trial-ending, dunning (payment failed), renewal receipt, plan-changed. **Missing: card-expiring, first-payment receipt, subscription-cancellation confirmation, invoice-available.** A failing/expiring card downgrades a paying customer with no proactive save. | Critical (churn/revenue) | `notifications.processor` send* list |

---

## 3. High-Priority Improvements

| # | Area | Issue | Severity |
|---|---|---|---|
| H1 | Search | Only clients/staff/services/invoices/appointments/locations indexed. Missing: **messages/conversations, notes, gift cards, packages, memberships, promo codes, offers, campaigns, reports, settings**. | High |
| H2 | Search | Imprecise deep-links: service hit → `/dashboard/services` (list, not the item); appointment hit → `/dashboard/appointments` (no focus/date); client hit routes via `?search=name` (ambiguous for duplicate names). | High |
| H3 | Landing/Home | No authentic photography, **no product/demo video**, no testimonial faces, no trust/compliance badges rendered as imagery. `public/` contains only logos. Top-of-funnel proof is weak. | High |
| H4 | Multi-location | No per-location **booking page / URL / branding**, and Locations page is bare CRUD — no per-location settings hub (hours, staff, services, deposits in one place). | High |
| H5 | Feature discovery | High-margin features (memberships, packages, campaigns, waitlist, gift cards) have **no tours, tooltips, or announcements** → low activation → low upgrade rate. | High |
| H6 | Retention | No structured onboarding **email** sequence, activation reminders, win-back, or cancellation-rescue flow (in-app dunning exists; lifecycle drip does not). | High |
| H7 | Comp plan | No **countdown banner** in the dashboard for an active comp grant, no "upgrade to keep access" CTA before expiry, no feature-comparison-before-downgrade. | High |

---

## 4. Medium-Priority Improvements

- **M1 — Onboarding "Share your booking link" step never completes** (`done: false` hardcoded), so the checklist can't reach 100% organically and never auto-hides on the intended trigger. *(`OnboardingWizard.tsx:46`)*
- **M2 — Settings is a tabbed mega-page** (`?tab=payments|security|notifications|online|payouts`). Deep-linkable but not in the sidebar as discrete pages; mixes billing, security, payouts, booking config. Cognitive load is high.
- **M3 — Location scope lives only in `localStorage`**, so switching devices loses the selected branch context; also no per-location indicator on records that could belong to "All locations."
- **M4 — Search has no recents, no keyboard arrow-navigation through results, no result-type filters** (Linear/Notion-class expectation).
- **M5 — Staff nav is permission-gated but thin**; no staff-facing today/agenda home, no per-staff earnings view.
- **M6 — No empty-state CTAs on several marketing/financial pages (unverified per-page)**; core components (`EmptyState`, `Skeleton`, `loading.tsx`, `error.tsx`) exist and are used on at least clients/locations.
- **M7 — Reports is a single page**; enterprise buyers expect saved views, scheduled email exports, and per-location/per-staff breakdowns.

---

## 5. Low-Priority Improvements

- L1 — Mobile topbar is crowded (locale toggle + New booking + search + bell + messages + avatar) on small screens; consider an overflow menu.
- L2 — `9+` notification cap vs `99+` message cap is inconsistent.
- L3 — Comp-plan revert restores `complimentaryPreviousPlan ?? 'FREE'` but doesn't notify staff/owner of the downgrade in-app.
- L4 — `New booking` always routes to `/dashboard/checkout`; consider a quick-add appointment modal to save a full page load.
- L5 — Several FR labels are dictionary-mapped inline in `layout.tsx`; long-term move to the i18n dictionaries for consistency.

---

## 6. Revenue Opportunities

| Opportunity | Mechanism | Est. ARR impact (Year 1) |
|---|---|---|
| Fix comp/influencer lifecycle (C1, H7) | Influencer-granted accounts convert to paid at expiry instead of silently lapsing | **+3–6%** |
| Complete billing emails + card-expiry save (C3) | Recover involuntary churn (expired/failed cards are ~20–40% of SaaS churn) | **+4–8%** |
| True multi-location (C2, H4) | Unlocks Unlimited-tier expansion & multi-branch prospects you currently can't serve well | **+8–15%** |
| Feature-discovery system (H5) | Lifts FREE→PRO→Unlimited upgrades by surfacing memberships/packages/campaigns | **+5–10%** |
| Homepage proof + video (H3) | Higher top-of-funnel conversion (video demos typically +10–30% trial starts) | **+3–7% new logos** |
| Contact-migration concierge (Phase 14, already modeled) | Removes #1 switching barrier from competitors | **+5–10% conversion** |

---

## 7. Retention Opportunities

- Build a **lifecycle email engine** (onboarding drip, activation nudges, dormant-account win-back, cancellation-rescue with offer, renewal reminder) — the infra (BullMQ + Resend + templates) already exists; only the orchestration/sequences are missing.
- **Cancellation-rescue flow**: intercept `cancelAtPeriodEnd` with a save offer (pause, downgrade, discount) before it sticks.
- **Comp-plan → paid conversion sequence** (C1/H7): welcome → mid-term value email → 14/7/1-day expiry countdown → "keep your features" CTA.
- **Loyalty/referral**: a `Referral` model exists and a `/referrals` page — confirm reward fulfillment is automated and surfaced in-dashboard.

---

## 8. SEO Opportunities

Already strong: `robots.ts` with correct private-area disallows, JSON-LD on blog/compare/booking pages, comparison pages (vs Acuity/Calendly/Square/GlossGenius), blog, city + industry + feature landing pages, hreflang EN/FR, sitemap via rewrite.

Gaps / additions:
- **Per-location and per-service public pages** with `LocalBusiness` + `Service` schema for local "near me" SEO (depends on C2/H4).
- **Aggregate review schema** on the homepage once testimonials are real (don't fake it — CASL/honesty risk).
- **More bottom-funnel comparison + "alternative to" pages** and pricing-intent pages.
- **Booking pages**: confirm `noindex` is intended on `/b/` and `/book` (currently disallowed) — public business booking pages arguably *should* be indexable for local discovery; this is a strategic call.

---

## 9. Compliance Risks

Strong baseline: privacy, terms, cookie consent, Canadian-privacy, Québec-compliance (Law 25), accessibility pages all exist; `PrivacyConsent`, `DataErasureRequest`, `AuditLog`, `LoginEvent` models present.

Open items to verify/close:
- **CASL**: every marketing/campaign send must carry sender identification + functioning unsubscribe, and store **express vs implied consent with timestamp/source**. Verify `Campaign` send path enforces this (C-risk if not).
- **SMS (CASL + carrier)**: reminders/marketing SMS need consent capture and STOP handling. Verify Twilio path honors opt-out.
- **WCAG 2.2 AA**: focus traps exist (command palette, modals) — good — but needs a full audit (color contrast on violet-on-amber, all interactive targets ≥44px, form error announcements).
- **Data retention**: define and enforce retention windows for `NotificationLog`, `LoginEvent`, `Message`, erased-client data.
- **Audit trail coverage**: confirm admin actions (comp grants ✓), data exports, and permission changes are all logged.

---

## 10. UX Improvements (Phase 1/12 consolidated)

- Reduce clicks on **New booking** (quick-add modal vs full checkout page) — L4.
- Make **Settings** sub-pages discoverable (M2).
- Persist **location scope** server-side (M3).
- Ensure every list page has a **loading skeleton + empty state with a primary CTA + error retry** (clients/locations confirmed; sweep the rest).
- Add **success/failure toasts** consistently (present in locations; verify across marketing/financial mutations).
- Tablet/desktop/mobile: sidebar collapses correctly at `lg`; audit the crowded mobile topbar (L1).

---

## 11. Dashboard Redesign Proposal (Phase 2)

The current IA is already good. Recommended **evolution, not overhaul**:

```
Home (overview)
Locations            ← promote to a real per-location hub (not just CRUD)
Calendar/Appointments
Clients
Booking Page
Communication ▾  Messages · Forms · Reminders · Reviews        (keep)
Catalog ▾        Services · Staff · Spaces & Equipment · Hours  (keep)
Workflow ▾       Tasks · Follow-ups · Waitlist                  (keep)
Payments ▾       Checkout · Transactions · Invoices · Deposits  (keep)
Reports          ← add saved views + scheduled exports
Marketing ▾      Campaigns · Offers · Promo · Gift cards · Packages · Memberships (keep)
Settings ▾       ← NEW: split the mega-tab into clickable sub-pages
                   Business · Booking · Payments/Payouts · Security · Notifications · Team & Permissions · Billing/Plan
```

Principles honored: nothing hidden; every dropdown parent remains a clickable hub (already true via `hasHub`); the only structural change is **splitting Settings tabs into discrete pages** (matching the Communications pattern you cited) and **upgrading Locations into a management hub**.

---

## 12. Search Improvements (Phase 3)

1. Index the missing entities (H1) — reuse the existing `pg_trgm` pattern; add GIN trigram indexes for messages/notes/marketing tables.
2. Fix deep-links to land on the specific record (H2): `/dashboard/clients/{id}`, appointment → calendar focused on its date, service → editor for that service.
3. Add **recents**, **arrow-key navigation**, **type filters**, and **grouped result counts** (M4).
4. Add typo-tolerant ranking weighting (already similarity-ordered) and a "no results → did you mean / create new" affordance.
5. Scope search results to the **selected location(s)** to match dashboard scope.

---

## 13. Billing Improvements (Phase 6)

Add the missing emails (C3): **card-expiring (proactive, 14/7/1 day), first-payment receipt, cancellation confirmation, invoice-available**. Then:
- Surface **`cancelAtPeriodEnd`** state + reactivation CTA in-dashboard.
- Add **Smart Retries / configurable dunning schedule** and an in-app "update card" banner when `PAST_DUE`.
- Confirm **Canadian tax (GST/HST/QST)** is applied on SaaS invoices and receipts show the business's tax numbers.
- Expose a **billing history / invoices** view in Settings → Billing.

---

## 14. Canadian Localization Improvements (Phase 8)

Strong: EN default + `/fr` route group, manual toggle (no auto-redirect — matches your i18n policy), Canadian timezones enumerated per-location, `en-CA` date formatting, Law 25 page.
- Sweep for **US spelling / `$`-without-CAD / US date order / "ZIP"** in any remaining copy.
- Ensure **currency displays CAD** explicitly where ambiguous.
- Default new businesses to a **Canadian timezone & CAD**; verify FR coverage on dashboard mutation toasts and emails (OTP/booking alerts already localized per memory).
- Tax wording: GST/HST/QST, not "sales tax."

---

## 15. Multi-location Improvements (Phase 13)

This is the highest-leverage enterprise gap. Recommended target experience:
1. **Location-scoped services & pricing** (add `locationId`/junction to Service or a per-location price override). *(largest change — see risks)*
2. **Staff at multiple locations** (junction table replacing singular `Staff.locationId`).
3. **Per-location management hub**: clicking a location opens its own page with that branch's hours, staff, services, deposits, and booking link in one place.
4. **Per-location public booking pages / slugs / branding.**
5. **Cross-location consolidated reporting** + the existing scope picker persisted server-side.
6. **Location-scoped permissions** (a manager who only manages Branch B).

---

## 16. Performance Improvements (Phase 15) — *partly unverified*

Observed positives: BullMQ offloads notifications; WebSocket replaces polling when connected; search is capped (`take 5`) and index-backed; module-level caching of `/auth/me`.
To verify/act on:
- **Bundle size** of the dashboard (40+ pages, lucide icons, sonner) — confirm route-level code-splitting and tree-shaken icons.
- **Image optimization** — only logos today; when real photography lands, use `next/image` + responsive sizes.
- **N+1 risk** in dashboard overview/reports aggregations — verify with query logging.
- **Caching headers** on public marketing/SEO pages (ISR/static).
- **Index coverage** for the new searchable/location-scoped tables.

---

## 17. Enterprise Readiness Score: **72 / 100**

| Dimension | Score | Note |
|---|---|---|
| Architecture & scalability | 8.5/10 | Clean module separation, serializable booking, BullMQ, WS |
| Security & auth | 7.5/10 | JWT+refresh, roles, 2FA, audit log, OTP; needs full WCAG/authz sweep |
| Billing maturity | 7/10 | Full Stripe lifecycle + dunning; email gaps (C3) |
| Multi-location | 4.5/10 | Scoped but not separately managed (C2) |
| Search | 5.5/10 | Good engine, shallow coverage |
| Lifecycle/retention comms | 5/10 | Strong appointment comms, weak SaaS lifecycle |
| Localization (CA/EN-FR) | 8/10 | Real bilingual infra |
| SEO | 8/10 | Mature; missing local/per-location pages |
| Compliance scaffolding | 7.5/10 | Pages + models exist; enforcement to verify |
| Marketing/visual proof | 5/10 | No photography/video/testimonials |
| Feature discovery | 5/10 | Checklist only |

---

## 18–21. Estimated Impact (directional)

| Metric | If High + Critical items shipped |
|---|---|
| **Customer satisfaction** | +15–25 pts (multi-location, comp clarity, fewer billing surprises) |
| **Retention** | **+10–18%** net (involuntary-churn recovery + cancellation rescue + lifecycle drip) |
| **Conversion rate** | **+15–30%** (homepage proof/video + migration concierge + feature discovery) |
| **ARR (Year 1)** | Cumulative **+25–45%** vs current trajectory; combined with the funnel work, a credible path toward the $1M target if traffic/sales motion scales alongside |

> ARR figures are planning estimates, not guarantees — they assume current top-of-funnel traffic and sales capacity; product fixes lift *conversion of existing demand* more reliably than they create new demand.

---

## Recommended Implementation Sequence (after your approval)

Each phase small, reviewable, tested before the next:
1. **Lifecycle comms** (C1, C3, H6, H7) — highest ROI, lowest structural risk.
2. **Search depth + deep-links** (H1, H2, M4).
3. **Homepage proof + video + trust badges** (H3) — needs your real assets.
4. **Settings split + Locations hub UI** (M2, H4) — UI-layer, low risk.
5. **True multi-location data model** (C2, H5 data work) — **highest risk; needs a migration plan** (see risks below).
6. **Feature discovery system** (H5) + onboarding fix (M1).

### Risks introduced by the big changes
- **C2 (location-scoped services / multi-location staff)** is a **schema migration** touching booking, availability, and pricing — risk of double-booking regressions and historical-data backfill. Must ship behind a flag with a reversible migration and extended concurrency tests.
- **Billing emails (C3)** risk over-emailing → spam complaints/CASL; dedupe and respect quiet hours.
- **Search expansion** risks slow queries on large tenants → require trigram indexes before launch.
- **Homepage media** risks performance regression → enforce `next/image` + lazy video.

---
*End of report. Awaiting approval before any code changes.*
