import type { Metadata } from "next";
import { CityLandingPage, cityBreadcrumb } from "@/components/CityLandingPage";

export const metadata: Metadata = {
  title: "Booking Software Edmonton | Pulse Appointments",
  description: "Online appointment booking software for Edmonton salons, barbers, spas, wellness providers, and service businesses. CAD pricing, deposits, and reminders.",
};

const breadcrumb = cityBreadcrumb("Edmonton", "edmonton");

export default function EdmontonPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <CityLandingPage
        city="Edmonton"
        province="AB"
        titleKeyword="Online appointment booking"
        primaryAudience="barbers, salons, estheticians, massage therapists, consultants, and mobile services"
        localAngle="Edmonton service businesses need reliable booking, clear appointment policies, and reminders that reduce gaps in the calendar. Pulse brings those pieces into one Canada-first platform."
      />
    </>
  );
}
