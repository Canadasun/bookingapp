import { buildAlternates } from "@/lib/hreflang";
import { StatusContent } from "@/components/marketing/StatusContent";

export const metadata = {
  alternates: buildAlternates("/status", "fr"),
  title: "État du système — Pulse Appointments",
  description: "Consultez la disponibilité en temps réel et les informations sur les incidents de Pulse Appointments.",
  openGraph: {
    title: "État du système — Pulse Appointments",
    description: "Consultez la disponibilité en temps réel et les informations sur les incidents de Pulse Appointments.",
  },
};

export default function StatusPageFr() {
  return <StatusContent locale="fr" />;
}
