"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Plus, X, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { api, Invoice, ClientWithStats, Business } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<Invoice["status"], string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-amber-50 text-amber-700 border border-amber-200",
  PAID: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  VOID: "bg-gray-100 text-gray-400 line-through",
};
const money = (cents: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: currency as "CAD" | "USD" }).format(cents / 100);

interface DraftLine { description: string; quantity: string; unitCents: string }

export default function InvoicesPage() {
  const user = getUser();
  const bizId = user?.businessId ?? "";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [biz, setBiz] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [inv, cl, b] = await Promise.all([
        api.invoices.list(bizId),
        api.clients.list(bizId).catch(() => ({ data: [] as ClientWithStats[] })),
        api.business.get(bizId).catch(() => null),
      ]);
      setInvoices(inv);
      setClients(cl.data);
      setBiz(b);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load invoices"); }
    finally { setLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Invoices</h2>
          <p className="text-sm text-gray-500">{invoices.length} total</p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5"><Plus className="w-4 h-4" /> New invoice</Button>
      </div>

      {loading ? <LoadingSpinner /> : invoices.length === 0 ? (
        <EmptyState title="No invoices yet" description="Create an invoice with custom line items — it gets the next sequential number automatically." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500">
            <span>#</span><span>Client</span><span>Date</span><span>Total</span><span>Status</span>
          </div>
          <div className="divide-y divide-gray-50">
            {invoices.map((inv) => (
              <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`}
                className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                <span className="font-mono text-sm font-semibold text-gray-700">#{String(inv.number).padStart(4, "0")}</span>
                <span className="text-sm text-gray-800 truncate">{inv.client?.name ?? <span className="text-gray-400">No client</span>}</span>
                <span className="hidden md:block text-xs text-gray-400">{format(new Date(inv.createdAt), "MMM d, yyyy")}</span>
                <span className="text-sm font-semibold text-gray-900">{money(inv.totalCents, inv.currency)}</span>
                <span className={cn("justify-self-start md:justify-self-auto inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[inv.status])}>{inv.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {showNew && (
        <NewInvoiceModal bizId={bizId} clients={clients} currency={biz?.currency ?? "CAD"} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />
      )}
    </div>
  );
}

function NewInvoiceModal({ bizId, clients, currency, onClose, onCreated }: {
  bizId: string; clients: ClientWithStats[]; currency: "CAD" | "USD"; onClose: () => void; onCreated: (inv: Invoice) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ description: "", quantity: "1", unitCents: "" }]);
  const [saving, setSaving] = useState(false);

  const setLine = (i: number, patch: Partial<DraftLine>) => setLines((p) => p.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const addLine = () => setLines((p) => [...p, { description: "", quantity: "1", unitCents: "" }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));

  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * Math.round(Number(l.unitCents || 0) * 100), 0);

  async function save() {
    const lineItems = lines
      .map((l) => ({ description: l.description.trim(), quantity: Number(l.quantity) || 0, unitCents: Math.round(Number(l.unitCents || 0) * 100) }))
      .filter((l) => l.description && l.quantity > 0);
    if (lineItems.length === 0) { toast.error("Add at least one line item with a description and quantity"); return; }
    setSaving(true);
    try {
      const inv = await api.invoices.create(bizId, {
        clientId: clientId || undefined,
        notes: notes.trim() || undefined,
        dueAt: dueAt ? new Date(`${dueAt}T00:00:00`).toISOString() : undefined,
        lineItems,
      });
      toast.success(`Invoice #${String(inv.number).padStart(4, "0")} created`);
      onCreated(inv);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to create invoice"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-violet-600" /><p className="text-sm font-semibold text-gray-900">New invoice</p></div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client (optional)</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700">
                <option value="">— None —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due date (optional)</label>
              <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Line items</label>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input placeholder="Description" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} className="flex-1" />
                  <Input type="number" min={1} placeholder="Qty" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className="w-16" />
                  <Input type="number" min={0} step="0.01" placeholder="Price" value={l.unitCents} onChange={(e) => setLine(i, { unitCents: e.target.value })} className="w-24" />
                  <button onClick={() => removeLine(i)} disabled={lines.length === 1} className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <button onClick={addLine} className="mt-2 text-xs font-semibold text-violet-600 hover:underline">+ Add line</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <Input placeholder="Payment terms, thank-you note…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-sm text-gray-500">Subtotal</span>
            <span className="text-sm font-semibold text-gray-900">{money(subtotal, currency)}</span>
          </div>
          <p className="text-xs text-gray-400 -mt-2">Tax is applied automatically from your business rate.</p>

          <Button className="w-full" loading={saving} onClick={save}>Create invoice</Button>
        </div>
      </div>
    </div>
  );
}
