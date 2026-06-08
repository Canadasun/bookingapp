"use client";

import { useEffect, useState, use, useCallback, useRef } from "react";
import { format } from "date-fns";
import { Printer, ArrowLeft, Send, Edit2, Check, X, Plus, Trash2, Mail } from "lucide-react";
import Link from "next/link";
import { api, Invoice, Business, InvoiceCreatePayload } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

const NEXT_STATUS: Record<Invoice["status"], { label: string; to: Invoice["status"] }[]> = {
  DRAFT: [{ label: "Mark sent", to: "SENT" }, { label: "Mark paid", to: "PAID" }, { label: "Void", to: "VOID" }],
  SENT: [{ label: "Mark paid", to: "PAID" }, { label: "Void", to: "VOID" }],
  PAID: [{ label: "Reopen (draft)", to: "DRAFT" }],
  VOID: [{ label: "Reopen (draft)", to: "DRAFT" }],
};

type LineItem = { description: string; quantity: number; unitCents: number };

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: currency as "CAD" }).format(cents / 100);
}

function StatusBadge({ status }: { status: Invoice["status"] }) {
  const colors: Record<Invoice["status"], string> = {
    DRAFT: "bg-gray-100 text-gray-600",
    SENT: "bg-amber-100 text-amber-700",
    PAID: "bg-emerald-100 text-emerald-700",
    VOID: "bg-red-100 text-red-500",
  };
  return <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide", colors[status])}>{status}</span>;
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = getUser();
  const bizId = user?.businessId ?? "";
  const [inv, setInv] = useState<Invoice | null>(null);
  const [biz, setBiz] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Edit state
  const [lines, setLines] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [taxRate, setTaxRate] = useState<number | "">("");
  const [discountCents, setDiscountCents] = useState<number | "">("");
  const [discountLabel, setDiscountLabel] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [billingAddress, setBillingAddress] = useState("");

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    try {
      const [i, b] = await Promise.all([api.invoices.get(bizId, id), api.business.get(bizId).catch(() => null)]);
      setInv(i); setBiz(b);
      resetEditState(i);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load invoice"); }
    finally { setLoading(false); }
  }, [bizId, id]);

  useEffect(() => { load(); }, [load]);

  function resetEditState(i: Invoice) {
    setLines(i.lineItems.map((li) => ({ description: li.description, quantity: li.quantity, unitCents: li.unitCents })));
    setNotes(i.notes ?? "");
    setDueAt(i.dueAt ? i.dueAt.split("T")[0] : "");
    setTaxRate(i.taxRatePercent ?? "");
    setDiscountCents(i.discountCents ? i.discountCents / 100 : "");
    setDiscountLabel(i.discountLabel ?? "");
    setPaymentTerms(i.paymentTerms ?? "");
    setPoNumber(i.poNumber ?? "");
    setBillingAddress(i.billingAddress ?? "");
  }

  async function setStatus(to: Invoice["status"]) {
    if (!inv) return;
    setBusy(true);
    try {
      const u = await api.invoices.setStatus(bizId, inv.id, to);
      setInv((p) => p ? { ...p, status: u.status } : p);
      toast.success(`Marked ${to.toLowerCase()}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function saveEdits() {
    if (!inv) return;
    setBusy(true);
    try {
      const payload: Partial<InvoiceCreatePayload> = {
        lineItems: lines,
        notes: notes || null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        taxRatePercent: taxRate === "" ? null : Number(taxRate),
        discountCents: discountCents === "" ? 0 : Math.round(Number(discountCents) * 100),
        discountLabel: discountLabel || null,
        paymentTerms: paymentTerms || null,
        poNumber: poNumber || null,
        billingAddress: billingAddress || null,
      };
      const updated = await api.invoices.update(bizId, inv.id, payload);
      setInv(updated);
      resetEditState(updated);
      setEditing(false);
      toast.success("Invoice saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save"); }
    finally { setBusy(false); }
  }

  async function sendEmail() {
    if (!inv) return;
    setSending(true);
    try {
      const result = await api.invoices.sendByEmail(bizId, inv.id);
      toast.success(`Invoice sent to ${result.sentTo}`);
      setInv((p) => p ? { ...p, status: p.status === "DRAFT" ? "SENT" : p.status } : p);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to send"); }
    finally { setSending(false); }
  }

  if (loading) return <LoadingSpinner />;
  if (!inv) return <p className="text-center text-gray-400 py-12">Invoice not found.</p>;

  const curr = inv.currency || biz?.currency || "CAD";
  const lineTotal = lines.reduce((s, li) => s + li.quantity * li.unitCents, 0);
  const discountAmt = discountCents === "" ? 0 : Math.round(Number(discountCents) * 100);
  const discounted = Math.max(lineTotal - discountAmt, 0);
  const previewTax = taxRate === "" ? 0 : Math.round(discounted * (Number(taxRate) / 100));
  const previewTotal = discounted + previewTax;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Action bar */}
      <div className="flex items-center justify-between mb-4 gap-2 print:hidden flex-wrap">
        <Link href="/dashboard/invoices" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600">
          <ArrowLeft className="w-4 h-4" /> Invoices
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {!editing && inv.status === "DRAFT" && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5">
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </Button>
          )}
          {editing && (
            <>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); if (inv) resetEditState(inv); }} className="gap-1.5">
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
              <Button size="sm" disabled={busy} onClick={saveEdits} className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
                <Check className="w-3.5 h-3.5" /> Save
              </Button>
            </>
          )}
          {!editing && inv.client?.email && (
            <Button size="sm" variant="outline" disabled={sending} onClick={sendEmail} className="gap-1.5">
              <Mail className="w-3.5 h-3.5" /> {sending ? "Sending…" : "Send by email"}
            </Button>
          )}
          {!editing && NEXT_STATUS[inv.status].map((a) => (
            <Button key={a.to} size="sm" variant="outline" disabled={busy} onClick={() => setStatus(a.to)}>{a.label}</Button>
          ))}
          <Button size="sm" onClick={() => window.print()} className="gap-1.5 print:hidden">
            <Printer className="w-4 h-4" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* Invoice document */}
      <div ref={printRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm print:shadow-none print:border-0 print:rounded-none overflow-hidden">

        {/* Header band */}
        <div className="bg-amber-500 px-8 py-7 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {biz?.logoUrl
              ? <img src={biz.logoUrl} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-white/30" />
              : <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-xl">
                  {(biz?.name ?? inv.business?.name ?? "B")[0]}
                </div>}
            <div>
              <p className="text-white font-bold text-xl leading-tight">{biz?.name ?? inv.business?.name ?? "Business"}</p>
              {(biz?.email ?? inv.business?.email) && <p className="text-white/80 text-sm">{biz?.email ?? inv.business?.email}</p>}
              {(biz?.phone ?? inv.business?.phone) && <p className="text-white/80 text-sm">{biz?.phone ?? inv.business?.phone}</p>}
              {(biz?.address ?? inv.business?.address) && <p className="text-white/70 text-xs mt-0.5">{biz?.address ?? inv.business?.address}</p>}
              {inv.business?.taxNumber && <p className="text-white/70 text-xs">Tax #: {inv.business.taxNumber}</p>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-white/70 text-xs uppercase tracking-widest font-semibold mb-1">Invoice</p>
            <p className="text-white font-bold text-3xl">#{String(inv.number).padStart(4, "0")}</p>
            <div className="mt-2"><StatusBadge status={inv.status} /></div>
            {inv.dueAt && <p className="text-white/80 text-xs mt-1.5">Due: {format(new Date(inv.dueAt), "MMM d, yyyy")}</p>}
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">

          {/* Meta row: client + dates + PO */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Bill To</p>
              {editing ? (
                <Textarea
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder={"Client name\nAddress line 1\nCity, Province, Postal"}
                  rows={4}
                  className="text-xs resize-none"
                />
              ) : (
                <>
                  {inv.billingAddress ? (
                    <p className="text-gray-700 text-sm whitespace-pre-line">{inv.billingAddress}</p>
                  ) : inv.client ? (
                    <>
                      <p className="font-semibold text-gray-900">{inv.client.name}</p>
                      <p className="text-gray-500 text-xs">{inv.client.email}</p>
                      {inv.client.phone && <p className="text-gray-500 text-xs">{inv.client.phone}</p>}
                    </>
                  ) : <p className="text-gray-400">—</p>}
                </>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Invoice Date</p>
                <p className="text-gray-700">{format(new Date(inv.createdAt), "MMM d, yyyy")}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Due Date</p>
                {editing ? (
                  <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="h-7 text-xs" />
                ) : (
                  <p className="text-gray-700">{inv.dueAt ? format(new Date(inv.dueAt), "MMM d, yyyy") : "On receipt"}</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">PO Number</p>
                {editing ? (
                  <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Optional" className="h-7 text-xs" />
                ) : (
                  <p className="text-gray-700">{inv.poNumber || "—"}</p>
                )}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_56px_88px_88px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Description</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">Qty</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Unit Price</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Amount</span>
            </div>

            {editing ? (
              <>
                {lines.map((li, i) => (
                  <div key={i} className="grid grid-cols-[1fr_56px_88px_88px_32px] gap-2 px-4 py-2.5 border-b border-gray-50 items-center">
                    <Input
                      value={li.description}
                      onChange={(e) => setLines((prev) => prev.map((l, j) => j === i ? { ...l, description: e.target.value } : l))}
                      placeholder="Service or item"
                      className="h-7 text-xs"
                    />
                    <Input
                      type="number" min={1} value={li.quantity}
                      onChange={(e) => setLines((prev) => prev.map((l, j) => j === i ? { ...l, quantity: Number(e.target.value) } : l))}
                      className="h-7 text-xs text-center"
                    />
                    <Input
                      type="number" min={0} step="0.01" value={(li.unitCents / 100).toFixed(2)}
                      onChange={(e) => setLines((prev) => prev.map((l, j) => j === i ? { ...l, unitCents: Math.round(Number(e.target.value) * 100) } : l))}
                      className="h-7 text-xs text-right"
                    />
                    <span className="text-xs text-gray-500 text-right">{money(li.quantity * li.unitCents, curr)}</span>
                    <button onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setLines((prev) => [...prev, { description: "", quantity: 1, unitCents: 0 }])}
                  className="w-full flex items-center gap-1.5 px-4 py-2.5 text-xs text-violet-600 hover:bg-violet-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add line item
                </button>
              </>
            ) : (
              inv.lineItems.map((li, i) => (
                <div key={i} className="grid grid-cols-[1fr_56px_88px_88px] gap-2 px-4 py-3 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-800">{li.description}</span>
                  <span className="text-sm text-gray-500 text-center">{li.quantity}</span>
                  <span className="text-sm text-gray-500 text-right">{money(li.unitCents, curr)}</span>
                  <span className="text-sm font-medium text-gray-900 text-right">{money(li.amountCents, curr)}</span>
                </div>
              ))
            )}
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{money(editing ? lineTotal : inv.subtotalCents, curr)}</span>
              </div>
              {/* Discount row */}
              {editing ? (
                <div className="flex gap-2 items-center">
                  <Input
                    value={discountLabel}
                    onChange={(e) => setDiscountLabel(e.target.value)}
                    placeholder="Discount label"
                    className="h-7 text-xs flex-1"
                  />
                  <Input
                    type="number" min={0} step="0.01"
                    value={discountCents === "" ? "" : String(discountCents)}
                    onChange={(e) => setDiscountCents(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0.00"
                    className="h-7 text-xs w-24 text-right"
                  />
                </div>
              ) : (inv.discountCents ?? 0) > 0 ? (
                <div className="flex justify-between text-red-500">
                  <span>{inv.discountLabel || "Discount"}</span>
                  <span>−{money(inv.discountCents!, curr)}</span>
                </div>
              ) : null}
              {/* Tax row */}
              {editing ? (
                <div className="flex justify-between items-center gap-2 text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <span className="shrink-0">Tax</span>
                    <Input
                      type="number" min={0} max={100} step="0.1"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                      className="h-7 text-xs w-16 text-right"
                    />
                    <span className="shrink-0">%</span>
                  </div>
                  <span>{money(previewTax, curr)}</span>
                </div>
              ) : (inv.taxCents ?? 0) > 0 ? (
                <div className="flex justify-between text-gray-500">
                  <span>Tax ({inv.taxRatePercent}%)</span>
                  <span>{money(inv.taxCents, curr)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-2.5">
                <span>Total ({curr})</span>
                <span>{money(editing ? previewTotal : inv.totalCents, curr)}</span>
              </div>
            </div>
          </div>

          {/* Payment terms */}
          {editing ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Payment Terms</p>
              <Textarea
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. Net 30 days. Payment by e-transfer to payments@business.com"
                rows={2}
                className="text-xs resize-none"
              />
            </div>
          ) : inv.paymentTerms ? (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Payment Terms</p>
              <p className="text-xs text-gray-600 whitespace-pre-line">{inv.paymentTerms}</p>
            </div>
          ) : null}

          {/* Notes */}
          <div className={!editing && !inv.notes ? "hidden" : ""}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Notes</p>
            {editing ? (
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes, thank-you message, etc."
                rows={3}
                className="text-xs resize-none"
              />
            ) : (
              <p className="text-xs text-gray-500 whitespace-pre-wrap">{inv.notes}</p>
            )}
          </div>

          <p className="text-center text-[10px] text-gray-300 pt-2 border-t border-gray-50">
            Powered by Pulse Appointments
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(#__next) { display: none !important; }
          .print\\:hidden { display: none !important; }
          @page { margin: 0.75in; }
        }
      `}</style>
    </div>
  );
}
