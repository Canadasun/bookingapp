import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { ReviewsContent } from "@/components/marketing/ReviewsContent";

export const metadata: Metadata = {
  title: "Customer Review Collection for Service Businesses | Pulse Appointments",
  description: "Pulse helps Canadian service businesses collect, moderate, and publish real appointment reviews without fabricated testimonials.",
  alternates: buildAlternates("/reviews"),
  openGraph: {
    title: "Real Review Collection | Pulse Appointments",
    description: "Collect and publish reviews tied to completed appointments.",
    url: "https://www.pulseappointments.com/reviews",
  },
};

export default function ReviewsMarketingPage() {
  return <ReviewsContent locale="en" />;
}
