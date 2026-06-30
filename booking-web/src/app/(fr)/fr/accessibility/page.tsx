import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { AccessibilityContent } from "@/components/marketing/AccessibilityContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/accessibility", "fr"),
  title: "Déclaration d’accessibilité — Pulse",
  description: "Pulse Appointments s’engage à respecter l’accessibilité WCAG 2.2 AA. Découvrez nos normes, nos limites connues et comment signaler un problème.",
  openGraph: {
    title: "Déclaration d’accessibilité — Pulse Appointments",
    description: "Pulse Appointments s’engage à respecter l’accessibilité WCAG 2.2 AA.",
  },
  twitter: {
    card: "summary",
    title: "Déclaration d’accessibilité — Pulse Appointments",
    description: "Pulse Appointments s’engage à respecter l’accessibilité WCAG 2.2 AA.",
  },
};

export default function AccessibilityPageFr() {
  return <AccessibilityContent locale="fr" />;
}
