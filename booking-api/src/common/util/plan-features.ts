import { PlanTier } from '@prisma/client';
import { featuresUnlocked } from './plan';

export function isPaidPlan(plan: PlanTier | undefined | null) {
  return featuresUnlocked() || plan === 'BASIC' || plan === 'PRO';
}

export function isProPlan(plan: PlanTier | undefined | null) {
  return featuresUnlocked() || plan === 'PRO';
}

export function applyPlanLimits<T extends {
  requireDeposit?: boolean;
  noShowFeeCents?: number;
  cancellationFeeCents?: number;
}>(plan: PlanTier, data: T): T {
  if (!isPaidPlan(plan)) {
    return {
      ...data,
      requireDeposit: false,
      noShowFeeCents: 0,
      cancellationFeeCents: 0,
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
