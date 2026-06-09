// Feature-gating by plan tier.
//
// Launch mode keeps all product features open. Set UNLOCK_ALL_FEATURES=false
// when paid-plan enforcement is intentionally enabled after launch.

export function featuresUnlocked(): boolean {
  return process.env.UNLOCK_ALL_FEATURES !== 'false';
}

// The plan to use when deciding whether a FEATURE is available. Treats everyone
// as PRO while unlocked; otherwise the business's real plan.
export function effectivePlan(plan?: string | null): 'FREE' | 'BASIC' | 'PRO' | 'UNLIMITED' {
  if (featuresUnlocked()) return 'UNLIMITED';
  return (plan as 'FREE' | 'BASIC' | 'PRO' | 'UNLIMITED') ?? 'FREE';
}
