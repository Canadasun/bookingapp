import { PlanTier } from '@prisma/client';
import { featuresUnlocked } from './plan';

export function isPaidPlan(plan: PlanTier | undefined | null) {
  return featuresUnlocked() || plan === 'BASIC' || plan === 'PRO' || plan === 'UNLIMITED';
}

export function isProPlan(plan: PlanTier | undefined | null) {
  return featuresUnlocked() || plan === 'PRO' || plan === 'UNLIMITED';
}

// UNLIMITED-specific checks. Multi-location itself starts at PRO (2 locations);
// UNLIMITED raises that limit to 5.
export function isUnlimitedPlan(plan: PlanTier | undefined | null) {
  return featuresUnlocked() || plan === 'UNLIMITED';
}

// Returns how many automatic no-show/late-cancel fee charges a business may
// make per calendar month. PRO+ is unlimited; FREE and BASIC each get 1/mo.
export function getMonthlyFeeAllowance(plan: PlanTier | undefined | null): number {
  if (isProPlan(plan)) return Infinity;
  return 1; // FREE and BASIC: 1 per calendar month
}

export function applyPlanLimits<T extends {
  requireDeposit?: boolean;
  noShowFeeCents?: number;
  cancellationFeeCents?: number;
  collectCardOnFile?: boolean;
  bookingApprovalMode?: string;
}>(plan: PlanTier, data: T): T {
  if (!isPaidPlan(plan)) {
    // FREE: no deposits, no card-on-file, no auto-confirm.
    // noShowFeeCents/cancellationFeeCents are NOT zeroed — FREE gets 1 prompt/mo
    // (enforced at charge time via getMonthlyFeeAllowance). Without a card on file
    // the fee is owner-collected manually; the configuration is still saved.
    return {
      ...data,
      requireDeposit: false,
      collectCardOnFile: false,
      bookingApprovalMode: 'MANUAL',
    };
  }
  // BASIC and above: no limits applied here. Monthly fee cap (1/mo for BASIC)
  // is enforced in bookings.service.ts and payments.service.ts at charge time.
  return data;
}
