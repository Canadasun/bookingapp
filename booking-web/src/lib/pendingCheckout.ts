// A paid Stripe Payment Link checkout that still needs to be attached to a
// business. The email-registration path claims it straight from the URL, but
// the SSO path bounces through Google/Apple (losing the query string) and
// finishes on /register/complete — so the session id is stashed client-side to
// survive that round-trip and claimed once the business exists.

const KEY = "pulse_checkout_session";
// Guard against a stale id from an abandoned flow attaching to an unrelated
// signup hours later. The claim is also idempotent + ownership-guarded server-side.
const MAX_AGE_MS = 60 * 60 * 1000;

export function storePendingCheckout(sessionId: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id: sessionId, ts: Date.now() }));
  } catch { /* private mode / storage disabled — claim simply won't carry over */ }
}

export function readPendingCheckout(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { id, ts } = JSON.parse(raw) as { id?: string; ts?: number };
    if (!id || !ts || Date.now() - ts > MAX_AGE_MS) return null;
    return id;
  } catch {
    return null;
  }
}

export function clearPendingCheckout() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

// Attach an already-paid subscription to the freshly created business. Best-effort:
// the Stripe webhook also reconciles, so callers proceed regardless of the result.
export async function claimCheckout(sessionId: string): Promise<{ ok: boolean; plan?: string }> {
  try {
    const res = await fetch("/api/payments/claim-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json().catch(() => ({}))) as { plan?: string };
    return { ok: true, plan: data.plan };
  } catch {
    return { ok: false };
  }
}
