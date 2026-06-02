import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const SITE_URL = "https://www.pulseappointments.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Pulse — Scheduling made simple",
    template: "%s · Pulse",
  },
  description: "Let your clients book appointments online 24/7 — automated reminders, deposit collection, and a beautiful dashboard, all in one place.",
  applicationName: "Pulse",
  openGraph: {
    type: "website",
    siteName: "Pulse",
    title: "Pulse — Scheduling made simple",
    description: "Book appointments online, 24/7. Automated reminders, deposits, and a beautiful dashboard.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Pulse — Scheduling made simple",
    description: "Book appointments online, 24/7.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#E9A23C",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} style={{ colorScheme: "light" }}>
      <body className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
