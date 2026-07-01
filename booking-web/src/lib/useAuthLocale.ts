"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { readStoredLocale } from "@/lib/locale-preference";

// Decide whether an auth page (login/register) should render in French.
//
// FR is an explicit `?lang=fr`, or — when that is unset — the visitor's stored
// preference from the language toggle. Explicit `?lang` always wins so both
// languages stay shareable. This avoids hidden referrer-based switching and
// keeps the auth flow deterministic.
export function useAuthLocale(): boolean {
  const searchParams = useSearchParams();
  const langParam = searchParams.get("lang");
  const [fr, setFr] = useState(() => {
    if (langParam) return langParam === "fr";
    const saved = readStoredLocale();
    return saved === "fr";
  });
  useEffect(() => {
    if (langParam) {
      setFr(langParam === "fr");
      return;
    }
    const saved = readStoredLocale();
    if (saved) setFr(saved === "fr");
  }, [langParam]);
  return fr;
}
