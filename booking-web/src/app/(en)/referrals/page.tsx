import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { ReferralsContent } from "@/components/marketing/ReferralsContent";

export const metadata: Metadata = {
  title: "Referral Program for Canadian Service Businesses | Pulse Appointments",
  description: "Share Pulse with another Canadian service business. Referral codes are built into signup and billing so eligible rewards can be applied through Stripe.",
  alternates: buildAlternates("/referrals"),
  openGraph: {
    title: "Pulse Referral Program",
    description: "Invite another Canadian service business to Pulse with a referral code.",
    url: "https://www.pulseappointments.com/referrals",
  },
};

export default function ReferralsPage() {
  return <ReferralsContent locale="en" />;
}
