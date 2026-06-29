import type { Metadata } from "next";
import { IndustryPage } from "@/components/IndustryPage";
import { ShieldCheck, FileText, RefreshCw } from "lucide-react";

export const metadata: Metadata = {
  title: "Booking Software for Nail Techs | Pulse Appointments",
  description: "Nail salon booking with deposits, no-show protection, gel and acrylic service protection, and client intake forms. Canada-first, CAD pricing.",
  openGraph: { title: "Nail Tech Booking Software | Pulse Appointments", description: "No-show protection and deposits for Canadian nail technicians." },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Booking Software for Nail Techs", item: "https://www.pulseappointments.com/for/nail-techs" },
  ],
};

export default function NailTechsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <IndustryPage
        title="Nail Techs"
        headline="Protect every nail appointment with Pulse"
        subheadline="Gel sets and acrylics take 2+ hours. A no-show or last-minute cancel wastes your whole slot. Pulse requires a deposit at booking and charges automatically if they don't show."
        heroEmoji="💅"
        features={[
          {
            icon: ShieldCheck,
            title: "Deposit protection for long appointments",
            body: "Require a 25-50% deposit for gel sets, acrylics, and nail art. A no-show? The deposit is yours. Late cancel? Charge the card on file. Your time is worth protecting.",
          },
          {
            icon: FileText,
            title: "Client intake for nail health",
            body: "Ask about nail conditions, allergies, sensitivities, and current products at booking. Clients fill it in when they book — you're prepared before they sit down.",
          },
          {
            icon: RefreshCw,
            title: "Fill and maintenance reminders",
            body: "Pulse automatically sends rebooking reminders when clients are due for a fill or maintenance appointment based on the service interval you set.",
          },
        ]}
        checklist={[
          "Online booking 24/7 from any device",
          "Deposits for gel sets, acrylics, and nail art",
          "No-show fee auto-charge with card-on-file",
          "Client nail health intake form",
          "Fill and maintenance rebooking reminders",
          "Automated 24h and 2h appointment reminders",
          "Cancellation policy with late-cancel fee",
          "Client visit history and service notes",
          "Google review automation after each appointment",
          "Gift cards for holiday gifting",
          "Booking link for Instagram bio",
          "CAD pricing with HST/GST on invoices",
        ]}
      />
    </>
  );
}
