"use client";

import { useEffect, useState, use, useCallback } from "react";
import { format } from "date-fns";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api, Invoice, Business } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

const NEXT_STATUS: Record<Invoice["status"], { label: string; to: Invoice["status"] }[]> = {
  DRAFT: [{ label: "Mark sent", to: "SENT" }, { label: "Mark paid", to: "PAID" }, { label: "Void", to: "VOID" }],
  SENT: [{ label: "Mark paid", to: "PAID" }, { label: "Void", to: "VOID" }],
  PAID: [{ label: "Reopen (draft)", to: "DRAFT" }],
  VOID: [{ label: "Reopen (draft)", to: "DRAFT" }],
};

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = getUser();
  const bizId = user?.businessId ?? "";
  const [inv, setInv] = useState<Invoice | null>(null);
  const [biz, setBiz] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    try {
      const [i, b] = await Promise.all([api.invoices.get(bizId, id), api.business.get(bizId).catch(() => null)]);
      setInv(i); setBiz(b);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load invoice"); }
    finally { setLoading(false); }
  }, [bizId, id]);
  useEffect(() => { load(); }, [load]);

  async function setStatus(to: Invoice["status"]) {
    if (!inv) return;
    setBusy(true);
    try { const u = await api.invoices.setStatus(bizId, inv.id, to); setInv((p) => p ? { ...p, status: u.status } : p); toast.success(`Marked ${to.toLowerCase()}`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (loading) return <LoadingSpinner />;
  if (!inv) return <p className="text-center text-gray-400 py-12">Invoice not found.</p>;

  const money = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: inv.currency as "CAD" | "USD" }).format(c / 100);
  const statusColor = inv.status === "PAID" ? "text-emerald-600" : inv.status === "VOID" ? "text-gray-400" : inv.status === "SENT" ? "text-amber-600" : "text-gray-500";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-2 print:hidden">
        <Link href="/dashboard/invoices" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600"><ArrowLeft className="w-4 h-4" /> Invoices</Link>
        <div className="flex items-center gap-2">
          {NEXT_STATUS[inv.status].map((a) => (
            <Button key={a.to} size="sm" variant="outline" disabled={busy} onClick={() => setStatus(a.to)}>{a.label}</Button>
          ))}
          <Button size="sm" onClick={() => window.print()} className="gap-1.5"><Printer className="w-4 h-4" /> Print / PDF</Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 print:shadow-none print:border-0">
        <div className="flex items-start justify-between gap-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {biz?.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={biz.logoUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
              : <div className="w-12 h-12 rounded-xl bg-violet-600" />}
            <div>
              <p className="text-lg font-bold text-gray-900">{biz?.name ?? "Business"}</p>
              {biz?.email && <p className="text-xs text-gray-400">{biz.email}</p>}
              {biz?.phone && <p className="text-xs text-gray-400">{biz.phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase tracking-wide text-gray-400">Invoice</p>
            <p className="text-xs text-gray-500 mt-1 font-mono">#{String(inv.number).padStart(4, "0")}</p>
            <p className="text-xs text-gray-400 mt-0.5">{format(new Date(inv.createdAt), "MMM d, yyyy")}</p>
            <p className={cn("text-xs font-bold uppercase mt-1", statusColor)}>{inv.status}</p>
          </div>
        </div>

        <div className="py-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Billed to</p>
            {inv.client ? (
              <>
                <p className="font-medium text-gray-900">{inv.client.name}</p>
                <p className="text-xs text-gray-500">{inv.client.email}</p>
                {inv.client.phone && <p className="text-xs text-gray-500">{inv.client.phone}</p>}
              </>
            ) : <p className="text-gray-400">—</p>}
          </div>
          {inv.dueAt && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Due</p>
              <p className="text-gray-700">{format(new Date(inv.dueAt), "MMM d, yyyy")}</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400 pb-2">
            <span>Description</span><span className="text-right">Qty</span><span className="text-right">Unit</span><span className="text-right">Amount</span>
          </div>
          {inv.lineItems.map((li, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-sm py-1.5 border-t border-gray-50">
              <span className="text-gray-800">{li.description}</span>
              <span className="text-right text-gray-500">{li.quantity}</span>
              <span className="text-right text-gray-500">{money(li.unitCents)}</span>
              <span className="text-right font-medium text-gray-900">{money(li.amountCents)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 mt-2 pt-4 space-y-1.5 text-sm ml-auto max-w-[260px]">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{money(inv.subtotalCents)}</span></div>
          {inv.taxCents > 0 && <div className="flex justify-between text-gray-500"><span>Tax ({inv.taxRatePercent}%)</span><span>{money(inv.taxCents)}</span></div>}
          <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-100"><span>Total</span><span>{money(inv.totalCents)}</span></div>
        </div>

        {inv.notes && <p className="mt-6 text-xs text-gray-500 border-t border-gray-100 pt-4 whitespace-pre-wrap">{inv.notes}</p>}
        <p className="text-center text-xs text-gray-300 mt-8">Powered by Pulse</p>
      </div>
    </div>
  );
}
