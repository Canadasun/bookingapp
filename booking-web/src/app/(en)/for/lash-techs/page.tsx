import type { Metadata } from "next";
import { IndustryPage } from "@/components/IndustryPage";
import { ShieldCheck, Bell, RefreshCw } from "lucide-react";

export const metadata: Metadata = {
  title: "Booking Software for Lash Techs | Pulse Appointments",
  description: "Lash extension booking with deposits, fill-in reminders, consent forms, and no-show protection. Canada-first, CAD pricing.",
  openGraph: { title: "Lash Tech Booking Software | Pulse Appointments", description: "No-show protection and fill reminders for Canadian lash artists." },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Booking Software for Lash Techs", item: "https://www.pulseappointments.com/for/lash-techs" },
  ],
};

export default function LashTechsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <IndustryPage
      title="Lash Techs"
      headline="Booking software that protects lash tech appointments"
      subheadline="Full sets take 2-3 hours. A no-show at that slot costs you real money. Pulse requires a deposit — and charges automatically if they cancel last minute."
      heroEmoji="👁️"
      features={[
        {
          icon: ShieldCheck,
          title: "Deposit protection for long appointments",
          body: "Require 25-50% upfront for full sets. No-show? The deposit is yours. Late cancel? Charge the card on file. Your time has real value.",
        },
        {
          icon: RefreshCw,
          title: "Fill-in reminders",
          body: "Pulse automatically reminds clients when they're due for a fill based on the service cadence you set. Turns a one-time client into a monthly regular.",
        },
        {
          icon: Bell,
          title: "Prep instructions built-in",
          body: "The booking confirmation email includes your custom pre-appointment instructions — no makeup, clean lashes, no oils. Clients arrive ready.",
        },
      ]}
      checklist={[
        "Online booking from Instagram, TikTok, or your website",
        "Deposits for full sets and volume sets",
        "No-show fee auto-charge with card-on-file",
        "Automated fill-in rebooking reminders",
        "Client intake form (lash history, allergies, sensitivities)",
        "Cancellation policy enforcement",
        "Automated 24h and 2h reminders",
        "Post-appointment care instructions via email",
        "Client photos attached to notes (upload)",
        "Google review automation after each service",
        "CAD pricing — invoice with HST",
        "Booking page for Instagram bio link",
      ]}
    />
    </>
  );
}
