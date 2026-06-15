export function consumeFragmentToken(storageKey: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const token = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? undefined;
  try {
    if (token) window.sessionStorage.setItem(storageKey, token);
    if (window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    return token ?? window.sessionStorage.getItem(storageKey) ?? undefined;
  } catch {
    // sessionStorage is unavailable (e.g. Safari private mode).
    // Fall back to the fragment token directly without persisting it.
    if (window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    return token;
  }
}
