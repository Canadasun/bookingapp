"use client";

import { useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";

interface PayInfo {
  mode?: "payment" | "setup" | "none";
  clientSecret?: string;
  amountCents?: number;
  publishableKey?: string;
  currency?: "CAD" | "USD";
}

function fmt(cents: number, currency: "CAD" | "USD" = "CAD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function PaymentForm({ info, onPaid }: { info: PayInfo; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true); setErr("");
    // redirect: "if_required" keeps the customer on-page for card payments that
    // don't need 3DS; for ones that do, Stripe handles the redirect.
    const result = info.mode === "setup"
      ? await stripe.confirmSetup({ elements, redirect: "if_required" })
      : await stripe.confirmPayment({ elements, redirect: "if_required" });
    setLoading(false);
    if (result.error) { setErr(result.error.message ?? "Payment failed"); return; }
    onPaid();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <Button type="submit" className="w-full py-6 text-base font-semibold" loading={loading} disabled={!stripe}>
        {info.mode === "setup"
          ? "Save card & confirm booking"
          : `Pay ${fmt(info.amountCents ?? 0, info.currency)} deposit & confirm`}
      </Button>
      <p className="text-center text-xs text-gray-400">Secured by Stripe · your card is not charged for the full service now.</p>
    </form>
  );
}

/**
 * Renders the Stripe payment step for a booking that requires a deposit or a
 * card on file. Only used when the API returns required:true AND a publishable
 * key is present — otherwise the booking flow skips this entirely.
 */
export function BookingPayment({ info, onPaid }: { info: PayInfo; onPaid: () => void }) {
  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (info.publishableKey ? loadStripe(info.publishableKey) : null),
    [info.publishableKey],
  );

  if (!stripePromise || !info.clientSecret) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
        Payment is required for this booking, but the payment provider is not configured. Please contact the business before booking.
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
      <Elements stripe={stripePromise} options={{ clientSecret: info.clientSecret, appearance: { theme: "stripe" } }}>
        <PaymentForm info={info} onPaid={onPaid} />
      </Elements>
    </div>
  );
}
