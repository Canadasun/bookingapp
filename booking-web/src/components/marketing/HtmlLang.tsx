"use client";

import { useEffect } from "react";

// The single root <html lang="en"> is owned by the app's root layout, which
// can't vary per route without opting every marketing page out of static
// rendering (or restructuring the whole app under a [lang] segment). For the
// French subtree we correct the document language on the client so assistive
// tech announces content in French; SEO language targeting is already handled
// by the per-page hreflang/canonical alternates in generateMetadata.
export function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [lang]);

  return null;
}
