import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { CityLandingPage, cityBreadcrumb } from "@/components/CityLandingPage";

export const metadata: Metadata = {
  alternates: buildAlternates("/for/montreal"),
  title: "Booking Software Montréal | Pulse Appointments",
  description: "Online booking software for Montréal salons, spas, wellness providers, and appointment-based businesses, with CAD pricing and bilingual client booking.",
};
export default function MontrealPage() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(cityBreadcrumb("Montréal", "montreal")) }} /><CityLandingPage city="Montréal" province="QC" titleKeyword="Appointment booking software" primaryAudience="salons, spas, wellness providers, and independent professionals" localAngle="Montréal businesses serve clients in French and English. Pulse supports a bilingual booking journey while keeping scheduling, deposits, and reminders in one place." /></>;
}
