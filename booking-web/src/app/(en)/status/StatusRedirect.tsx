"use client";

import { useEffect } from "react";

export function StatusRedirect({ url, delayMs }: { url: string; delayMs: number }) {
  useEffect(() => {
    const t = setTimeout(() => { window.location.href = url; }, delayMs);
    return () => clearTimeout(t);
  }, [url, delayMs]);
  return null;
}
