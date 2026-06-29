import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { CityLandingPage, cityBreadcrumb } from "@/components/CityLandingPage";

export const metadata: Metadata = {
  alternates: buildAlternates("/for/quebec-city"),
  title: "Booking Software Québec City | Pulse Appointments",
  description: "Online booking software for Québec City appointment businesses, with CAD pricing, French client booking, reminders, and no-show protection.",
};
export default function QuebecCityPage() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(cityBreadcrumb("Québec", "quebec-city")) }} /><CityLandingPage city="Québec" province="QC" titleKeyword="Appointment booking software" primaryAudience="salons, spas, clinics, wellness providers, and independent professionals" localAngle="Québec City businesses need a French-first client experience backed by practical scheduling, deposit, and reminder tools." /></>;
}
