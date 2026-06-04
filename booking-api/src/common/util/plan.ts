// Feature-gating by plan tier.
//
// TESTING PHASE: every business gets full (PRO-tier) FUNCTIONALITY regardless of
// their actual plan, so new users can try everything. Set UNLOCK_ALL_FEATURES=false
// to re-enforce plan tiers. This affects FEATURE gates only — billing/subscription
// logic must keep reading the real `business.plan`.

export function featuresUnlocked(): boolean {
  return process.env.UNLOCK_ALL_FEATURES !== 'false'; // default ON during testing
}

// The plan to use when deciding whether a FEATURE is available. Treats everyone
// as PRO while unlocked; otherwise the business's real plan.
export function effectivePlan(plan?: string | null): 'FREE' | 'BASIC' | 'PRO' {
  if (featuresUnlocked()) return 'PRO';
  return (plan as 'FREE' | 'BASIC' | 'PRO') ?? 'FREE';
}
