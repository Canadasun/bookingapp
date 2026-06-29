import type { Metadata, Viewport } from "next";

// Shared root metadata/viewport for every root layout. The app now has two root
// layouts (English at the site root, French under /fr) so they can emit
// different <html lang> tags; everything else about the document head is
// identical and lives here to avoid drift between the two layouts.
const SITE_URL = "https://www.pulseappointments.com";

const GOOGLE_SITE_VERIFICATION =
  process.env.GOOGLE_SITE_VERIFICATION ??
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ??
  "";

function metadataForLocale(locale: "en_CA" | "fr_CA"): Metadata {
  const french = locale === "fr_CA";
  return {
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
    locale,
    alternateLocale: [french ? "en_CA" : "fr_CA"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pulse — Scheduling made simple",
    description: "Book appointments online, 24/7.",
    images: [`${SITE_URL}/opengraph-image`],
  },
  verification: GOOGLE_SITE_VERIFICATION
    ? { google: GOOGLE_SITE_VERIFICATION }
    : undefined,
  other: {
    'apple-itunes-app': 'app-id=6774881206, app-argument=https://www.pulseappointments.com',
  },
};
}

export const sharedMetadata: Metadata = metadataForLocale("en_CA");
export const sharedFrenchMetadata: Metadata = metadataForLocale("fr_CA");

export const sharedViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#E9A23C",
  colorScheme: "light",
};
