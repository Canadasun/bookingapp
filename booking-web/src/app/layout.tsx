import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { CookieConsent } from "@/components/CookieConsent";
import { SessionRefresher } from "@/components/SessionRefresher";
import "./globals.css";

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID ?? "";

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
    images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630, alt: "Pulse — Scheduling made simple" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pulse — Scheduling made simple",
    description: "Book appointments online, 24/7.",
    images: [`${SITE_URL}/opengraph-image`],
  },
  other: {
    'apple-itunes-app': 'app-id=6774881206, app-argument=https://www.pulseappointments.com',
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
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-violet-700 focus:rounded focus:shadow-lg focus:outline-none"
        >
          Skip to main content
        </a>
        <SessionRefresher />
        {children}
        <Toaster richColors position="top-right" />
        <CookieConsent clarityId={CLARITY_ID || undefined} />
      </body>
    </html>
  );
}
