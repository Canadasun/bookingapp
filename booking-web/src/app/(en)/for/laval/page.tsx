import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { CityLandingPage, cityBreadcrumb } from "@/components/CityLandingPage";

export const metadata: Metadata = {
  alternates: buildAlternates("/for/laval"),
  title: "Booking Software Laval | Pulse Appointments",
  description: "Online booking software for Laval salons, spas, wellness providers, and appointment-based service businesses.",
};
export default function LavalPage() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(cityBreadcrumb("Laval", "laval")) }} /><CityLandingPage city="Laval" province="QC" titleKeyword="Appointment booking software" primaryAudience="salons, spas, wellness providers, and mobile service businesses" localAngle="Laval service businesses can offer French-friendly online booking, reduce missed appointments, and manage growing schedules without adding front-desk work." /></>;
}
