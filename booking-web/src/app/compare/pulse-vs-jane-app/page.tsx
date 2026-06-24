import type { Metadata } from "next";
import { ComparePage } from "@/components/ComparePage";

export const metadata: Metadata = {
  title: "Pulse vs. Jane App | For Non-Clinical Service Businesses",
  description: "Compare Pulse and Jane App. Jane is built for regulated health clinics. Pulse is for independent service businesses — salons, lash techs, pet groomers, consultants.",
};

export default function VsJanePage() {
  return (
    <ComparePage
      competitor="Jane App"
      tagline="Pulse vs. Jane App"
      summary="Jane App is an excellent platform for regulated health clinics (physiotherapy, counselling, chiropractic). Pulse is purpose-built for independent service businesses — beauty, wellness, grooming, and consulting professionals who don't need a clinical EHR."
      pulseWins={[
        "Simpler setup for non-clinical businesses — 5 minutes to launch",
        "Lower pricing for solo providers",
        "Better marketing tools: campaigns, gift cards, referrals",
        "Social bio page for Instagram/TikTok",
        "No-show fee auto-charge to card-on-file",
        "Birthday and win-back campaign automation",
        "Cleaner client-facing booking experience",
      ]}
      theyWin={[
        "EHR/SOAP notes for regulated health professionals",
        "Insurance billing and direct billing",
        "Telehealth and video sessions",
        "Consent forms with e-signature",
        "Strong reputation in Canadian health clinics",
      ]}
      features={[
        { feature: "Online booking page", pulse: true, them: true },
        { feature: "CAD pricing", pulse: true, them: true },
        { feature: "PIPEDA compliance", pulse: true, them: true },
        { feature: "Deposits at booking", pulse: true, them: true },
        { feature: "No-show fee auto-charge", pulse: true, them: "Partial" },
        { feature: "Gift cards", pulse: true, them: false },
        { feature: "Memberships", pulse: true, them: false },
        { feature: "Birthday campaigns", pulse: true, them: false },
        { feature: "Win-back campaigns", pulse: true, them: false },
        { feature: "Social bio page", pulse: true, them: false, highlight: true },
        { feature: "Revenue Protected metric", pulse: true, them: false, highlight: true },
        { feature: "Setup time under 5 minutes", pulse: true, them: false, highlight: true },
        { feature: "EHR / SOAP notes", pulse: false, them: true },
        { feature: "Insurance direct billing", pulse: false, them: true },
        { feature: "Telehealth video sessions", pulse: false, them: true },
        { feature: "Consent forms with e-signature", pulse: false, them: true },
      ]}
      pricingComparison={{
        pulseLabel: "Pro plan (solo provider)",
        pulsePrice: "$69/mo",
        pulseCurrency: "CAD · No contracts",
        themLabel: "Solo practitioner",
        themPrice: "$74/mo",
        themCurrency: "CAD",
        themNote: "Designed for clinical settings",
      }}
    />
  );
}
