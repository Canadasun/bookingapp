"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, X, Trash2, FileText, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { api, Invoice, ClientWithStats, Business, InvoiceCreatePayload, Location } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { useDashboardLocale } from "@/lib/dashboard-locale";

const STATUS_STYLE: Record<Invoice["status"], string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-amber-50 text-amber-700 border border-amber-200",
  PAID: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  VOID: "bg-gray-100 text-gray-400 line-through",
};
interface DraftLine { description: string; quantity: string; unitCents: string }

export default function InvoicesPage() {
  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [biz, setBiz] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const { french, formatCurrency, formatDate } = useDashboardLocale();

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoadError("");
    setLoading(true);
    try {
      const [inv, cl, b, locs] = await Promise.all([
        api.invoices.list(bizId),
        api.clients.list(bizId, undefined, 1, 500).catch(() => ({ data: [] as ClientWithStats[] })),
        api.business.get(bizId).catch(() => null),
        api.locations.list(bizId).catch(() => [] as Location[]),
      ]);
      setInvoices(inv);
      setClients(cl.data);
      setBiz(b);
      setLocations(locs.filter((l) => l.active));
    } catch (e) { setLoadError(e instanceof Error ? e.message : (french ? "Échec du chargement des factures" : "Failed to load invoices")); }
    finally { setLoading(false); }
  }, [bizId, french]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{french ? "Factures" : "Invoices"}</h2>
          <p className="text-sm text-gray-500">{invoices.length} {french ? "au total" : "total"}</p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5"><Plus className="w-4 h-4" /> {french ? "Nouvelle facture" : "New invoice"}</Button>
      </div>

      {loadError ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3">{loadError}</p>
          <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">{french ? "Réessayer" : "Retry"}</button>
        </div>
      ) : loading ? <LoadingSpinner /> : invoices.length === 0 ? (
        <EmptyState title={french ? "Aucune facture" : "No invoices yet"} description={french ? "Créez une facture avec des postes personnalisés; le prochain numéro séquentiel lui sera attribué automatiquement." : "Create an invoice with custom line items — it gets the next sequential number automatically."} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500">
            <span>#</span><span>Client</span><span>Date</span><span>Total</span><span>{french ? "État" : "Status"}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {invoices.map((inv) => (
              <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`}
                className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                <span className="font-mono text-sm font-semibold text-gray-700">#{String(inv.number).padStart(4, "0")}</span>
                <span className="text-sm text-gray-800 truncate">{inv.client?.name ?? <span className="text-gray-400">{french ? "Aucun client" : "No client"}</span>}</span>
                <span className="hidden md:block text-xs text-gray-400">{formatDate(inv.createdAt, { year: "numeric", month: "short", day: "numeric" })}</span>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(inv.totalCents, inv.currency as "CAD" | "USD")}</span>
                <span className={cn("justify-self-start md:justify-self-auto inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[inv.status])}>{french ? ({ DRAFT: "BROUILLON", SENT: "ENVOYÉE", PAID: "PAYÉE", VOID: "ANNULÉE" } as const)[inv.status] : inv.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {showNew && (
        <NewInvoiceModal bizId={bizId} clients={clients} locations={locations} businessTaxRate={biz?.taxRatePercent ?? 0} currency={biz?.currency ?? "CAD"} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />
      )}
    </div>
  );
}

function NewInvoiceModal({ bizId, clients, locations, businessTaxRate, currency, onClose, onCreated }: {
  bizId: string; clients: ClientWithStats[]; locations: Location[]; businessTaxRate: number; currency: "CAD" | "USD"; onClose: () => void; onCreated: (inv: Invoice) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ description: "", quantity: "1", unitCents: "" }]);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { french, formatCurrency } = useDashboardLocale();

  const setLine = (i: number, patch: Partial<DraftLine>) => setLines((p) => p.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const addLine = () => setLines((p) => [...p, { description: "", quantity: "1", unitCents: "" }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));

  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * Math.round(Number(l.unitCents || 0) * 100), 0);

  async function save() {
    const lineItems = lines
      .map((l) => ({ description: l.description.trim(), quantity: Number(l.quantity) || 0, unitCents: Math.round(Number(l.unitCents || 0) * 100) }))
      .filter((l) => l.description && l.quantity > 0);
    if (lineItems.length === 0) { toast.error(french ? "Ajoutez au moins un poste avec une description et une quantité" : "Add at least one line item with a description and quantity"); return; }
    setSaving(true);
    try {
      const payload: InvoiceCreatePayload = {
        clientId: clientId || undefined,
        locationId: locationId || undefined,
        notes: notes.trim() || null,
        dueAt: dueAt ? new Date(`${dueAt}T00:00:00`).toISOString() : null,
        lineItems,
        poNumber: poNumber.trim() || null,
        paymentTerms: paymentTerms.trim() || null,
      };
      const inv = await api.invoices.create(bizId, payload);
      toast.success(french ? `Facture no ${String(inv.number).padStart(4, "0")} créée` : `Invoice #${String(inv.number).padStart(4, "0")} created`);
      onCreated(inv);
    } catch (e) { toast.error(e instanceof Error ? e.message : (french ? "Échec de la création de la facture" : "Failed to create invoice")); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div className="dashboard-safe-bottom relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-violet-600" /><p id="invoice-modal-title" className="text-sm font-semibold text-gray-900">{french ? "Nouvelle facture" : "New invoice"}</p></div>
          <button onClick={onClose} aria-label={french ? "Fermer la fenêtre" : "Close dialog"}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="inv-client" className="block text-sm font-medium text-gray-700 mb-1">{french ? "Client (facultatif)" : "Client (optional)"}</label>
              <select id="inv-client" value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700">
                <option value="">— {french ? "Aucun" : "None"} —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {locations.length > 1 && (
              <div>
                <label htmlFor="inv-location" className="block text-sm font-medium text-gray-700 mb-1">{french ? "Emplacement (taxe)" : "Location (tax)"}</label>
                <select id="inv-location" value={locationId} onChange={(e) => setLocationId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700">
                  <option value="">{french ? "— Taxe de l’entreprise —" : "— Business tax —"}</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  {french ? "Taxe appliquée : " : "Tax applied: "}
                  {(locationId ? (locations.find((l) => l.id === locationId)?.taxRatePercent ?? businessTaxRate) : businessTaxRate)}%
                </p>
              </div>
            )}
            <div>
              <label htmlFor="inv-due" className="block text-sm font-medium text-gray-700 mb-1">{french ? "Date d’échéance (facultatif)" : "Due date (optional)"}</label>
              <Input id="inv-due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{french ? "Postes" : "Line items"}</label>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input placeholder="Description" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} className="flex-1" />
                  <Input type="number" min={1} placeholder={french ? "Qté" : "Qty"} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className="w-16" />
                  <Input type="number" min={0} step="0.01" placeholder={french ? "Prix" : "Price"} value={l.unitCents} onChange={(e) => setLine(i, { unitCents: e.target.value })} className="w-24" />
                  <button onClick={() => removeLine(i)} disabled={lines.length === 1} aria-label={french ? "Retirer le poste" : "Remove line item"} className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <button onClick={addLine} className="mt-2 text-xs font-semibold text-violet-600 hover:underline">+ {french ? "Ajouter un poste" : "Add line"}</button>
          </div>

          <div>
            <label htmlFor="inv-notes" className="block text-sm font-medium text-gray-700 mb-1">{french ? "Notes (facultatif)" : "Notes (optional)"}</label>
            <Textarea id="inv-notes" placeholder={french ? "Note de remerciement, information additionnelle…" : "Thank-you note, additional info…"} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="resize-none" />
          </div>

          {/* Advanced fields toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700"
          >
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showAdvanced && "rotate-180")} />
            {showAdvanced ? (french ? "Masquer" : "Hide") : (french ? "Afficher" : "Show")} {french ? "les champs avancés" : "advanced fields"}
          </button>

          {showAdvanced && (
            <div className="space-y-3 border border-gray-100 rounded-xl p-3 bg-gray-50">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{french ? "Numéro de bon de commande (facultatif)" : "PO Number (optional)"}</label>
                <Input placeholder={french ? "ex. BC-2026-001" : "e.g. PO-2026-001"} value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{french ? "Conditions de paiement (facultatif)" : "Payment Terms (optional)"}</label>
                <Textarea
                  placeholder={french ? "ex. Net 30 jours. Paiement par virement Interac à payments@entreprise.com" : "e.g. Net 30 days. Payment by e-transfer to payments@business.com"}
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>
              <p className="text-[11px] text-gray-400">More fields (discount, billing address, tax rate) can be edited after creation.</p>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-sm text-gray-500">{french ? "Sous-total" : "Subtotal"}</span>
            <span className="text-sm font-semibold text-gray-900">{formatCurrency(subtotal, currency)}</span>
          </div>
          <p className="text-xs text-gray-400 -mt-2">{french ? "La taxe est appliquée automatiquement selon le taux de votre entreprise." : "Tax is applied automatically from your business rate."}</p>

          <Button className="w-full" loading={saving} onClick={save}>{french ? "Créer la facture" : "Create invoice"}</Button>
        </div>
      </div>
    </div>
  );
}
