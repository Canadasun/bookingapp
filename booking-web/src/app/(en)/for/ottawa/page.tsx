import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { CityLandingPage, cityBreadcrumb } from "@/components/CityLandingPage";

export const metadata: Metadata = {
  alternates: buildAlternates("/for/ottawa"),
  title: "Booking Software Ottawa | Pulse Appointments",
  description: "Online booking software for Ottawa salons, spas, wellness providers, consultants, and appointment-based service businesses. CAD pricing and no-show protection.",
};

const breadcrumb = cityBreadcrumb("Ottawa", "ottawa");

export default function OttawaPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <CityLandingPage
        city="Ottawa"
        province="ON"
        titleKeyword="Appointment booking software"
        primaryAudience="salons, wellness providers, consultants, spas, and mobile service teams"
        localAngle="Ottawa businesses need a professional booking experience that handles clients in both official-language markets, protects long appointments, and keeps operations organized without a large front desk."
      />
    </>
  );
}
