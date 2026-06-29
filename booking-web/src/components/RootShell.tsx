import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { CookieConsent } from "@/components/CookieConsent";
import { MarketingEventTracker } from "@/components/MarketingEventTracker";
import { SessionRefresher } from "@/components/SessionRefresher";
import "@/app/globals.css";

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID ?? "";
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// The single shared document shell rendered by every root layout. The only
// thing that varies between root layouts is the `lang` attribute, so each
// layout passes its locale's BCP-47 tag (e.g. "en", "fr-CA") here.
export function RootShell({ lang, children }: { lang: string; children: React.ReactNode }) {
  return (
    <html lang={lang} className={inter.variable} style={{ colorScheme: "light" }}>
      <body className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-violet-700 focus:rounded focus:shadow-lg focus:outline-none"
        >
          Skip to main content
        </a>
        <MarketingEventTracker />
        <SessionRefresher />
        {children}
        <Toaster richColors position="top-right" />
        <CookieConsent
          clarityId={CLARITY_ID || undefined}
          gaMeasurementId={GA_MEASUREMENT_ID || undefined}
        />
      </body>
    </html>
  );
}
