import { PlanTier } from '@prisma/client';

export function isPaidPlan(plan: PlanTier | undefined | null) {
  return plan === 'BASIC' || plan === 'PRO';
}

export function isProPlan(plan: PlanTier | undefined | null) {
  return plan === 'PRO';
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
