"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Receipt, RotateCcw } from "lucide-react";
import { api, type Payment, type PaymentStatus } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";

const KIND_LABEL: Record<string, string> = {
  DEPOSIT: "Deposit",
  NO_SHOW_FEE: "No-show fee",
  LATE_CANCEL_FEE: "Late-cancel fee",
  IN_PERSON: "In-person",
  OTHER: "Charge",
};

const STATUS_STYLE: Record<PaymentStatus, string> = {
  SUCCEEDED: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-amber-100 text-amber-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELED: "bg-gray-100 text-gray-600",
  REFUNDED: "bg-gray-100 text-gray-600",
  PARTIALLY_REFUNDED: "bg-amber-100 text-amber-700",
};

export default function TransactionsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundFor, setRefundFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPayments(await api.payments.list()); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load transactions"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const collected = payments.filter((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED" || p.status === "REFUNDED")
    .reduce((s, p) => s + p.amountCents, 0);
  const refunded = payments.reduce((s, p) => s + p.refundedCents, 0);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Transactions</h2>
        <p className="text-sm text-gray-500">Deposits, no-show &amp; late-cancel fees, and in-person charges — with refunds.</p>
        {payments.length > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            {formatPrice(collected)} collected · {formatPrice(refunded)} refunded
          </p>
        )}
      </div>

      {loading ? <LoadingSpinner /> : payments.length === 0 ? (
        <EmptyState title="No transactions yet" description="Deposits and in-person charges will appear here." />
      ) : (
        <div className="space-y-3">
          {payments.map((p) => {
            const remaining = p.amountCents - p.refundedCents;
            const refundable = (p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED") && remaining > 0;
            return (
              <Card key={p.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900">{formatPrice(p.amountCents)}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status]}`}>
                          {p.status.replace("_", " ").toLowerCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {KIND_LABEL[p.kind] ?? p.kind}
                        {p.client ? ` · ${p.client.name}` : ""}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(new Date(p.createdAt), "MMM d, yyyy · h:mm a")}
                        {p.refundedCents > 0 && <span className="text-amber-600"> · {formatPrice(p.refundedCents)} refunded</span>}
                      </p>
                      {p.receiptUrl && (
                        <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 mt-1">
                          <Receipt className="w-3.5 h-3.5" /> View receipt
                        </a>
                      )}
                    </div>
                    {refundable && refundFor !== p.id && (
                      <Button variant="outline" size="sm" className="shrink-0" onClick={() => setRefundFor(p.id)}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Refund
                      </Button>
                    )}
                  </div>

                  {refundFor === p.id && (
                    <RefundForm
                      remainingCents={remaining}
                      onCancel={() => setRefundFor(null)}
                      onDone={() => { setRefundFor(null); load(); }}
                      paymentId={p.id}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
        <Receipt className="w-3.5 h-3.5" /> Records reconcile automatically with Stripe.
      </p>
    </div>
  );
}

function RefundForm({ paymentId, remainingCents, onDone, onCancel }: {
  paymentId: string; remainingCents: number; onDone: () => void; onCancel: () => void;
}) {
  const [amount, setAmount] = useState((remainingCents / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents <= 0 || cents > remainingCents) {
      toast.error(`Enter an amount between $0.01 and ${formatPrice(remainingCents)}`);
      return;
    }
    setBusy(true);
    try {
      // Full remaining → omit amount so the backend refunds the exact balance.
      await api.payments.refund(paymentId, cents === remainingCents ? undefined : cents, reason.trim() || undefined);
      toast.success("Refund issued");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refund failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 grid gap-2 sm:grid-cols-[120px_1fr_auto] items-end">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
        <Input type="number" step="0.01" min="0.01" max={(remainingCents / 100).toFixed(2)}
          value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. customer request" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button size="sm" onClick={submit} loading={busy}>Refund</Button>
      </div>
    </div>
  );
}
