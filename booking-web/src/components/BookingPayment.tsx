"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface PayInfo {
  mode?: "payment" | "setup" | "none";
  amountCents?: number;
  currency?: "CAD" | "USD";
  applicationId?: string;
  locationId?: string;
  saveCard?: boolean;
}

function fmt(cents: number, currency: "CAD" | "USD" = "CAD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

// Load the Square Web Payments SDK once. Sandbox application ids are prefixed
// "sandbox-", which also selects the sandbox SDK host.
function loadSquare(applicationId: string): Promise<any> {
  const sandbox = applicationId.startsWith("sandbox");
  const src = sandbox
    ? "https://sandbox.web.squarecdn.com/v1/square.js"
    : "https://web.squarecdn.com/v1/square.js";
  return new Promise((resolve, reject) => {
    const w = window as unknown as { Square?: unknown };
    if (w.Square) return resolve(w.Square);
    const done = () => (w.Square ? resolve(w.Square) : reject(new Error("Square SDK unavailable")));
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", done);
      existing.addEventListener("error", () => reject(new Error("Square SDK failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = src; s.async = true; s.onload = done; s.onerror = () => reject(new Error("Square SDK failed to load"));
    document.head.appendChild(s);
  });
}

/**
 * Square card form for a booking that needs a deposit or a card on file. The
 * card is tokenized in the browser; the token is sent to the API, which charges
 * (or saves) it server-side on the business's connected Square account.
 */
export function BookingPayment({
  info, appointmentId, businessId, onPaid,
}: {
  info: PayInfo;
  appointmentId: string;
  businessId: string;
  onPaid: () => void;
}) {
  const cardRef = useRef<any>(null);
  const paymentsRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!info.applicationId || !info.locationId) return;
    let card: any;
    let cancelled = false;
    (async () => {
      try {
        const Square = await loadSquare(info.applicationId!);
        const payments = (Square as any).payments(info.applicationId, info.locationId);
        paymentsRef.current = payments;
        card = await payments.card();
        if (cancelled) { card.destroy?.(); return; }
        await card.attach("#sq-card");
        cardRef.current = card;
        setReady(true);
      } catch {
        setErr("Couldn't load the secure card form. Please refresh and try again.");
      }
    })();
    return () => { cancelled = true; try { card?.destroy?.(); } catch { /* noop */ } };
  }, [info.applicationId, info.locationId]);

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
      // Best-effort buyer verification (3DS / SCA) for the deposit amount.
      let verificationToken: string | undefined;
      if (info.mode === "payment" && info.amountCents && paymentsRef.current?.verifyBuyer) {
        try {
          const vr = await paymentsRef.current.verifyBuyer(result.token, {
            amount: (info.amountCents / 100).toFixed(2),
            currencyCode: info.currency ?? "CAD",
            intent: "CHARGE",
          });
          verificationToken = vr?.token;
        } catch { /* proceed without 3DS */ }
      }
      const res = await api.payments.chargeBooking({
        appointmentId, businessId, sourceId: result.token, verificationToken,
        mode: info.mode === "setup" ? "setup" : "payment",
      });
      setLoading(false);
      if (!res.confirmed) { setErr("The payment didn't go through. Please try another card."); return; }
      onPaid();
    } catch (e) {
      setLoading(false);
      setErr(e instanceof Error ? e.message : "Payment failed. Please try again.");
    }
  }

  if (!info.applicationId || !info.locationId) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
        Payment is required for this booking, but the business hasn&apos;t connected a payment account yet. Please contact them before booking.
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">
        {info.mode === "setup" ? "Add a card to hold your spot" : "Pay your deposit"}
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        {info.mode === "setup"
          ? "We keep your card on file for the cancellation/no-show policy. You're not charged now."
          : `A ${fmt(info.amountCents ?? 0, info.currency)} deposit secures your appointment.`}
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div id="sq-card" className="min-h-[44px] rounded-xl border border-gray-200 p-1" />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <Button type="submit" className="w-full py-6 text-base font-semibold" loading={loading} disabled={!ready}>
          {info.mode === "setup"
            ? "Save card & confirm booking"
            : `Pay ${fmt(info.amountCents ?? 0, info.currency)} deposit & confirm`}
        </Button>
        <p className="text-center text-xs text-gray-400">Secured by Square · your card is not charged for the full service now.</p>
      </form>
    </div>
  );
}
