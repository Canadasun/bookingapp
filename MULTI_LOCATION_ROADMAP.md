# Multi-Location: Competitive Audit & Roadmap (vs Square Appointments)
**Report-only.** Grounded in the current schema/code. Goal: beat Square/Fresha/Boulevard for Canadian multi-location and support the $1M-ARR push.

---

## 1. Where we stand — capability matrix

| Capability | Square Appointments | Fresha / Boulevard | **Pulse today** | Gap |
|---|---|---|---|---|
| Location = address, phone, **timezone**, active | ✅ | ✅ | ✅ | — |
| Staff work at **multiple** locations | ✅ | ✅ | ✅ *(just shipped)* | — |
| **Per-location hours** | ✅ | ✅ | ✅ | — |
| Appointments/reports **scoped by location** | ✅ | ✅ | ✅ | — |
| Waitlist per location | ✅ | ✅ | ✅ *(just fixed)* | — |
| **Per-location service menu & pricing** | ✅ | ✅ | ⚠️ *derived from staff; no per-branch price* | **HIGH** |
| **Per-location tax** | ✅ (US) | ✅ | ❌ *one business rate → wrong across provinces* | **CRITICAL (CA compliance)** |
| **Per-location booking page / URL** | ✅ (each location a bookable site) | ✅ | ❌ *one business slug + in-page picker* | **HIGH (SEO + UX)** |
| **Per-location branding** (logo/name) | ✅ | ✅ | ❌ *business-level `logoUrl`* | MED |
| **Per-location deposits / cancellation policy** | ✅ | ✅ | ❌ *business-level* | MED |
| **Location-scoped staff permissions / managers** | ✅ (Team) | ✅ (roles) | ❌ *permissions are global* | **HIGH (enterprise)** |
| **Consolidated + drill-down analytics** | ✅ | ✅ | ⚠️ *filter only, no cross-location compare* | MED |
| Location **switching persists across devices** | ✅ (server) | ✅ | ❌ *localStorage only* | LOW |
| **Location groups / regions** | ✅ (Plus) | ✅ | ❌ | LOW (franchise tier) |
| Shared customer directory across locations | ✅ | ✅ | ✅ | — |
| Per-location **reviews** | partial | ✅ | ❌ *reviews are business-level* | MED |

**Read:** we have a solid *data* foundation (arguably cleaner than Square's item-library model) but shallow *per-location configuration* and no *per-location public presence*. That's what loses multi-location deals today.

---

## 2. 🔴 Elevated finding — per-location tax is a Canadian compliance risk

`Business.taxRatePercent` + `taxProvince` are **single values for the whole business**. A business with branches in ON (13% HST) and BC (5% GST + 7% PST) charges **one** rate everywhere → **incorrect tax collected/remitted at every out-of-province branch**, on invoices *and* receipts. This is not just UX — it's a CRA/Revenu Québec remittance exposure and it directly contradicts our "Canadian-first" positioning.

**Fix:** move tax to the Location (province → auto-preset GST/HST/QST), fall back to business rate when a branch has none. This is also a **differentiator**: Square handles US tax; *nobody* nails CA provincial tax per branch out of the box.

---

## 3. Square-parity gaps we must close to stop losing deals

1. **Per-location service menu & pricing** — let a branch enable/disable a service and override its price/duration (a downtown blowout costs more than the suburb). Add a `LocationService` override table; fall back to the base `Service`. Booking + checkout read the effective price for the chosen branch.
2. **Per-location booking pages/URLs** — `/book/[slug]/[locationSlug]` (or `/b/[locationSlug]`) with that branch pre-selected, its own address, hours, staff, and metadata. Unlocks local SEO (see §5) and clean per-branch links for Google/Instagram.
3. **Location-scoped permissions / location managers** — a manager who administers Branch B only (staff, calendar, reports for B). Add `locationId?` scoping to staff permissions; gate dashboard queries by managed locations.
4. **Per-location deposits & cancellation policy** — branch-level overrides of `requireDeposit/depositPercent/cancellationWindow/policy`, business as default.

---

## 4. 🚀 Differentiators to *beat* competitors (Canadian-first)

These go beyond Square and are hard for US-centric competitors to copy:

- **D1 — Per-province tax done right** (from §2): auto GST/HST/QST by branch province, correct receipts/invoices, per-location remittance reports. *Marketing line: "The only booking platform that gets Canadian multi-province tax right."*
- **D2 — Bilingual by branch** — a Québec branch's booking page **defaults to French** (with Law 25 / French-first compliance), an Ontario branch to English, all under one account. We already have the EN/FR infra; scope the default locale to the Location. No competitor does CA bilingual per-branch well.
- **D3 — Local SEO per branch** — generate an indexable per-location landing/booking page with `LocalBusiness` + `PostalAddress` + `GeoCoordinates` + `OpeningHours` schema and city/neighbourhood copy, so each branch ranks for "[service] near me" and "[service] in [city]." This turns multi-location into an **organic acquisition engine** — a moat Square doesn't offer.
- **D4 — "Find soonest / nearest" cross-location booking** — client enters a postal code or "any location"; we surface the soonest available slot across all branches and the nearest branch. Converts demand that a single-branch calendar would drop.
- **D5 — Centralized ⇄ decentralized modes** — owner chooses whether services/pricing/policies are locked head-office-wide or editable per branch. This is the Boulevard/enterprise selling point, delivered at SMB price — wins franchises and growing chains.
- **D6 — Cross-location memberships/packages & gift cards** — redeemable at any branch (we already model memberships/packages/gift cards at business level; make redemption explicitly location-aware). Mindbody charges enterprise pricing for this.

---

## 5. Why §4 maps to the $1M goal

- **D1/D2** remove the two reasons a Canadian chain would pick Square/Vagaro over us → win multi-location logos (highest ACV accounts).
- **D3** makes every new branch a set of ranking pages → compounding organic signups at ~zero CAC.
- **D4** lifts booking conversion on existing traffic.
- **D5** unlocks franchise/agency deals (10–100 locations) — the fastest path to $1M is a handful of multi-location chains, not only solo shops.

---

## 6. Suggested phased roadmap

**Phase A — Compliance + parity (highest ROI, ship first)**
1. Per-location tax (D1) — schema `Location.taxProvince/taxRatePercent`; thread into invoices, receipts, checkout, reports. *Also fix the `America/New_York` business default → a Canadian default.*
2. Per-location service pricing/enablement (`LocationService` override).
3. Per-location deposits & cancellation policy overrides.

**Phase B — Public presence + acquisition**
4. Per-location booking pages/URLs (D3 foundation) + per-branch metadata.
5. Local SEO schema + city landing pages per branch (D3).
6. Bilingual-by-branch default locale (D2).

**Phase C — Enterprise & growth**
7. Location-scoped permissions / location managers (§3.3).
8. Consolidated vs per-location analytics with cross-branch compare.
9. "Find soonest/nearest" cross-location booking (D4).
10. Location groups/regions + centralized/decentralized modes (D5) — franchise tier.

Each phase is independently shippable and testable; Phase A alone materially changes our competitive position and closes a compliance gap.

---

## 7. Recommendation

Start with **Phase A #1 (per-location tax)** — it's a compliance fix *and* a marketable differentiator, and it's a contained schema+threading change like the multi-location work we just shipped. I'd pair it with **#2 (per-location pricing)** since both touch the checkout/invoice path.

*Nothing here is built yet — awaiting your pick of what to implement.*
