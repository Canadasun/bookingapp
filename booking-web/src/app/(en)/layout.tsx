import type { Metadata, Viewport } from "next";
import { localeHtmlLang } from "@/i18n/config";
import { sharedMetadata, sharedViewport } from "@/lib/rootMetadata";
import { RootShell } from "@/components/RootShell";

// Root layout for the English site (served at the root, e.g. /security).
export const metadata: Metadata = sharedMetadata;
export const viewport: Viewport = sharedViewport;

export default function RootLayoutEn({ children }: { children: React.ReactNode }) {
  return <RootShell lang={localeHtmlLang.en}>{children}</RootShell>;
}
