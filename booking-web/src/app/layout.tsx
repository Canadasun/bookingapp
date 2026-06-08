import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
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
  },
  twitter: {
    card: "summary_large_image",
    title: "Pulse — Scheduling made simple",
    description: "Book appointments online, 24/7.",
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
        {children}
        <Toaster richColors position="top-right" />
        {CLARITY_ID && (
          <Script id="ms-clarity" strategy="afterInteractive">{`
            (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");
          `}</Script>
        )}
      </body>
    </html>
  );
}
