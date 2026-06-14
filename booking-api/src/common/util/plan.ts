// Feature-gating by plan tier.
//
// Fail-closed: features are locked unless UNLOCK_ALL_FEATURES is explicitly
// set to "true". Missing or misspelled → locked. Invalid value → startup crash.

const _unlockValue = process.env.UNLOCK_ALL_FEATURES;
if (_unlockValue !== undefined && _unlockValue !== 'true' && _unlockValue !== 'false') {
  throw new Error(`UNLOCK_ALL_FEATURES must be "true" or "false", got "${_unlockValue}"`);
}

export function featuresUnlocked(): boolean {
  return _unlockValue === 'true';
}

export function effectivePlan(plan?: string | null): 'FREE' | 'BASIC' | 'PRO' | 'UNLIMITED' {
  if (featuresUnlocked()) return 'UNLIMITED';
  return (plan as 'FREE' | 'BASIC' | 'PRO' | 'UNLIMITED') ?? 'FREE';
}

export function getCapabilities(plan: string | null | undefined) {
  const p = effectivePlan(plan);
  const paid     = p === 'BASIC' || p === 'PRO' || p === 'UNLIMITED';
  const pro      = p === 'PRO'   || p === 'UNLIMITED';
  const unlimited = p === 'UNLIMITED';
  return {
    deposits:          paid,
    cardOnFile:        paid,
    memberships:       paid,
    giftCards:         paid,
    sms:               pro,
    noShowFees:        pro,
    cancellationFees:  pro,
    marketing:         pro,
    multipleLocations: unlimited,
    removeBranding:    unlimited,
  };
}
