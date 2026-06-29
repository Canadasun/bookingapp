import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { CityLandingPage, cityBreadcrumb } from "@/components/CityLandingPage";

export const metadata: Metadata = {
  alternates: buildAlternates("/for/gatineau"),
  title: "Booking Software Gatineau | Pulse Appointments",
  description: "Online booking software for Gatineau salons, spas, wellness providers, consultants, and appointment-based businesses.",
};
export default function GatineauPage() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(cityBreadcrumb("Gatineau", "gatineau")) }} /><CityLandingPage city="Gatineau" province="QC" titleKeyword="Appointment booking software" primaryAudience="salons, wellness providers, consultants, spas, and independent professionals" localAngle="Gatineau businesses operate in a bilingual regional market. Pulse provides one booking workflow for French- and English-speaking clients." /></>;
}
