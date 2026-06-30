"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// Decide whether an auth page (login/register) should render in French.
//
// FR is an explicit `?lang=fr`, or — when that is unset — inferred from the
// visitor arriving via a /fr marketing page (same-origin referrer) or a prior
// language-toggle choice (`pulse_dashboard_locale`). Explicit `?lang` always
// wins so both languages stay shareable. This is the user's own context/choice,
// not Accept-Language sniffing, so it stays consistent with the site's
// "no silent auto-detect" rule.
export function useAuthLocale(): boolean {
  const searchParams = useSearchParams();
  const langParam = searchParams.get("lang");
  const [fr, setFr] = useState(langParam === "fr");
  useEffect(() => {
    if (langParam) { setFr(langParam === "fr"); return; }
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      const fromFrPage = !!ref && ref.origin === window.location.origin && ref.pathname.startsWith("/fr");
      if (fromFrPage || localStorage.getItem("pulse_dashboard_locale") === "fr") setFr(true);
    } catch { /* referrer/localStorage unavailable — stay English */ }
  }, [langParam]);
  return fr;
}
