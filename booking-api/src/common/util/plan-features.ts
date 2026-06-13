import { PlanTier } from '@prisma/client';
import { featuresUnlocked } from './plan';

export function isPaidPlan(plan: PlanTier | undefined | null) {
  return featuresUnlocked() || plan === 'BASIC' || plan === 'PRO' || plan === 'UNLIMITED';
}

export function isProPlan(plan: PlanTier | undefined | null) {
  return featuresUnlocked() || plan === 'PRO' || plan === 'UNLIMITED';
}

// UNLIMITED is the only tier that can manage multiple locations.
export function isUnlimitedPlan(plan: PlanTier | undefined | null) {
  return featuresUnlocked() || plan === 'UNLIMITED';
}

export function applyPlanLimits<T extends {
  requireDeposit?: boolean;
  noShowFeeCents?: number;
  cancellationFeeCents?: number;
  collectCardOnFile?: boolean;
}>(plan: PlanTier, data: T): T {
  if (!isPaidPlan(plan)) {
    return {
      ...data,
      requireDeposit: false,
      noShowFeeCents: 0,
      cancellationFeeCents: 0,
      collectCardOnFile: false,
    };
  }
  if (!isProPlan(plan)) {
    return {
      ...data,
      noShowFeeCents: 0,
      cancellationFeeCents: 0,
    };
  }
  return data;
}
