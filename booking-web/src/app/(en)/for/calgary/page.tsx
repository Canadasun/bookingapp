import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { CityLandingPage, cityBreadcrumb } from "@/components/CityLandingPage";

export const metadata: Metadata = {
  alternates: buildAlternates("/for/calgary"),
  title: "Booking Software Calgary | Pulse Appointments",
  description: "Online booking software for Calgary salons, spas, barbers, wellness providers, and service businesses. CAD pricing, deposits, SMS reminders, and no-show protection.",
};

const breadcrumb = cityBreadcrumb("Calgary", "calgary");

export default function CalgaryPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <CityLandingPage
        city="Calgary"
        province="AB"
        titleKeyword="Booking software"
        primaryAudience="salons, spas, barbers, massage therapists, and mobile service providers"
        localAngle="Calgary operators need booking that works across solo studios, neighbourhood shops, and mobile services. Pulse keeps the workflow simple: service, time, deposit, reminder, and client record."
      />
    </>
  );
}
