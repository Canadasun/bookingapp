// Feature-gating by plan tier.
//
// Optional development override: set UNLOCK_ALL_FEATURES=true to grant PRO-tier
// functionality locally. Production/default behavior enforces each business plan.

export function featuresUnlocked(): boolean {
  return process.env.UNLOCK_ALL_FEATURES === 'true';
}

// The plan to use when deciding whether a FEATURE is available. Treats everyone
// as PRO while unlocked; otherwise the business's real plan.
export function effectivePlan(plan?: string | null): 'FREE' | 'BASIC' | 'PRO' {
  if (featuresUnlocked()) return 'PRO';
  return (plan as 'FREE' | 'BASIC' | 'PRO') ?? 'FREE';
}
