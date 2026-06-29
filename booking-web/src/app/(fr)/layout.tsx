import type { Metadata, Viewport } from "next";
import { localeHtmlLang } from "@/i18n/config";
import { sharedMetadata, sharedViewport } from "@/lib/rootMetadata";
import { RootShell } from "@/components/RootShell";

// Root layout for the French site (served under /fr, e.g. /fr/security). This
// is a separate root layout purely so the document can declare lang="fr-CA" at
// the server-rendered HTML level — the only difference from the English root.
export const metadata: Metadata = sharedMetadata;
export const viewport: Viewport = sharedViewport;

export default function RootLayoutFr({ children }: { children: React.ReactNode }) {
  return <RootShell lang={localeHtmlLang.fr}>{children}</RootShell>;
}
