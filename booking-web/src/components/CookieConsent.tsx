"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const STORAGE_KEY = "cookie_consent";
type Consent = "accepted" | "necessary";

interface CookieConsentProps {
  clarityId?: string;
}

export function CookieConsent({ clarityId }: CookieConsentProps) {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Consent | null;
      setConsent(stored);
      setVisible(!stored);
    } catch {
      setVisible(true);
    }
  }, []);

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, "accepted"); } catch {}
    setConsent("accepted");
    setVisible(false);
  }

  function necessary() {
    try { localStorage.setItem(STORAGE_KEY, "necessary"); } catch {}
    setConsent("necessary");
    setVisible(false);
  }

  return (
    <>
      {clarityId && consent === "accepted" && (
        <Script id="ms-clarity" strategy="afterInteractive">{`
          (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");
        `}</Script>
      )}
      {visible && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cookie preferences"
          className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-xl px-4 py-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <p className="text-sm text-gray-700 flex-1 leading-relaxed">
            We use analytics cookies to improve your experience. See our{" "}
            <a href="/privacy" className="text-violet-600 underline hover:text-violet-700">
              privacy policy
            </a>
            .
          </p>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={necessary}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Necessary only
            </button>
            <button
              onClick={accept}
              className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors"
            >
              Accept all
            </button>
          </div>
        </div>
      )}
    </>
  );
}
