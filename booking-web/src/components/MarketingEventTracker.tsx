"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

const TRACKED_LINKS: Record<string, string> = {
  "/register": "sign_up_cta_click",
  "/pricing": "pricing_cta_click",
  "/demo": "demo_cta_click",
  "/referrals": "referral_page_click",
};

export function MarketingEventTracker() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const url = new URL(anchor.href, window.location.origin);
      const eventName = TRACKED_LINKS[url.pathname];
      if (!eventName) return;

      trackEvent(eventName, {
        destination: url.pathname,
        source_path: window.location.pathname,
        link_text: anchor.textContent?.trim().slice(0, 80) ?? "",
      });
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
