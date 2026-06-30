import { buildAlternates } from "@/lib/hreflang";
import { StatusContent } from "@/components/marketing/StatusContent";

export const metadata = {
  alternates: buildAlternates("/status"),
  title: "System Status — Pulse Appointments",
  description: "Check real-time uptime and incident information for Pulse Appointments.",
  openGraph: {
    title: "System Status — Pulse Appointments",
    description: "Check real-time uptime and incident information for Pulse Appointments.",
  },
};

export default function StatusPage() {
  return <StatusContent locale="en" />;
}
