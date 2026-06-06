"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

// Reuse the Square Web Payments SDK loader (sandbox vs prod by app-id prefix).
function loadSquare(applicationId: string): Promise<any> {
  const sandbox = applicationId.startsWith("sandbox");
  const src = sandbox ? "https://sandbox.web.squarecdn.com/v1/square.js" : "https://web.squarecdn.com/v1/square.js";
  return new Promise((resolve, reject) => {
    const w = window as unknown as { Square?: unknown };
    if (w.Square) return resolve(w.Square);
    const done = () => (w.Square ? resolve(w.Square) : reject(new Error("Square SDK unavailable")));
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) { existing.addEventListener("load", done); existing.addEventListener("error", () => reject(new Error("Square SDK failed to load"))); return; }
    const s = document.createElement("script");
    s.src = src; s.async = true; s.onload = done; s.onerror = () => reject(new Error("Square SDK failed to load"));
    document.head.appendChild(s);
  });
}

/**
 * Collects a card via the Square Web Payments SDK and subscribes the business to
 * a paid plan on Pulse's platform Square account. Fetches the platform
 * applicationId + locationId from the subscription status endpoint.
 */
export function SubscribeCardModal({
  plan, referralCode, onClose, onDone,
}: {
  plan: "BASIC" | "PRO";
  referralCode?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const cardRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [cfgMissing, setCfgMissing] = useState(false);

  useEffect(() => {
    let card: any;
    let cancelled = false;
    (async () => {
      try {
        const sub = await api.subscriptions.get();
        if (!sub.applicationId || !sub.locationId) { setCfgMissing(true); return; }
        const Square = await loadSquare(sub.applicationId);
        const payments = (Square as any).payments(sub.applicationId, sub.locationId);
        card = await payments.card();
        if (cancelled) { card.destroy?.(); return; }
        await card.attach("#sq-sub-card");
        cardRef.current = card;
        setReady(true);
      } catch { setErr("Couldn't load the secure card form. Please try again."); }
    })();
    return () => { cancelled = true; try { card?.destroy?.(); } catch { /* noop */ } };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const card = cardRef.current;
    if (!card) return;
    setLoading(true); setErr("");
    try {
      const result = await card.tokenize();
      if (result.status !== "OK" || !result.token) {
        setErr(result.errors?.[0]?.message ?? "Please check your card details.");
        setLoading(false); return;
      }
      await api.subscriptions.subscribe(plan, result.token, referralCode);
      toast.success(`You're on the ${plan} plan!`);
      onDone();
    } catch (e) {
      setLoading(false);
      setErr(e instanceof Error ? e.message : "Could not start the subscription.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-bold text-gray-900">Subscribe to {plan}</h3>
        <p className="mt-1 text-xs text-gray-500">Enter your card — billed to your business by Pulse via Square.</p>
        {cfgMissing ? (
          <p className="mt-4 text-sm text-amber-600">Billing isn&apos;t configured on the server yet. Please contact support.</p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div id="sq-sub-card" className="min-h-[44px] rounded-xl border border-gray-200 p-1" />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex items-center gap-2">
              <Button type="submit" className="flex-1" loading={loading} disabled={!ready}>Subscribe to {plan}</Button>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
