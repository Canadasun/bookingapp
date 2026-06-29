import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { CityLandingPage, cityBreadcrumb } from "@/components/CityLandingPage";

export const metadata: Metadata = {
  alternates: buildAlternates("/for/winnipeg"),
  title: "Booking Software Winnipeg | Pulse Appointments",
  description: "Online booking software for Winnipeg salons, spas, pet groomers, wellness providers, and appointment-based service businesses. CAD pricing and no-show protection.",
};

const breadcrumb = cityBreadcrumb("Winnipeg", "winnipeg");

export default function WinnipegPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <CityLandingPage
        city="Winnipeg"
        province="MB"
        titleKeyword="Appointment booking software"
        primaryAudience="salons, spas, pet groomers, wellness providers, and appointment-based teams"
        localAngle="Winnipeg businesses can use Pulse to replace DM scheduling, protect revenue with deposits, and give clients a clear mobile booking flow from any link."
      />
    </>
  );
}
