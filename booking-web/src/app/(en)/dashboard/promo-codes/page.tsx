"use client";

import { useCallback, useEffect, useState } from "react";
import { Tag, Plus, Trash2, ToggleLeft, ToggleRight, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { api, PromoCode } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDashboardLocale } from "@/lib/dashboard-locale";

export default function PromoCodesPage() {
  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [codeToDelete, setCodeToDelete] = useState<PromoCode | null>(null);
  const [form, setForm] = useState({ code: "", discountType: "PERCENT" as "PERCENT" | "FLAT", discountValue: "", maxUsages: "", expiresAt: "" });
  const { french, formatCurrency, formatDate } = useDashboardLocale();

  const load = useCallback(async () => {
    try { setCodes(await api.promoCodes.list(bizId)); }
    catch { toast.error(french ? "Impossible de charger les codes promo" : "Could not load promo codes"); }
    finally { setLoading(false); }
  }, [bizId, french]);

  useEffect(() => { if (bizId) void load(); }, [bizId, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim()) { toast.error(french ? "Le code est requis" : "Code is required"); return; }
    const val = parseFloat(form.discountValue);
    if (!val || val <= 0) { toast.error(french ? "Entrez une valeur de réduction valide" : "Enter a valid discount value"); return; }
    if (form.discountType === "PERCENT" && val > 100) { toast.error(french ? "Le pourcentage doit être de 0 à 100" : "Percentage must be 0–100"); return; }
    try {
      const pc = await api.promoCodes.create(bizId!, {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: form.discountType === "FLAT" ? val * 100 : val,
        maxUsages: form.maxUsages ? parseInt(form.maxUsages, 10) : undefined,
        expiresAt: form.expiresAt || undefined,
      });
      setCodes(p => [pc, ...p]);
      setShowForm(false);
      setForm({ code: "", discountType: "PERCENT", discountValue: "", maxUsages: "", expiresAt: "" });
      toast.success(french ? "Code promo créé" : "Promo code created");
    } catch (err) { toast.error(err instanceof Error ? err.message : (french ? "Échec de la création" : "Failed to create")); }
  }

  async function toggle(pc: PromoCode) {
    try {
      const updated = await api.promoCodes.update(bizId!, pc.id, { active: !pc.active });
      setCodes(p => p.map(c => c.id === pc.id ? updated : c));
    } catch { toast.error(french ? "Échec de la mise à jour" : "Failed to update"); }
  }

  async function doRemove() {
    if (!codeToDelete) return;
    try {
      await api.promoCodes.remove(bizId!, codeToDelete.id);
      setCodes(p => p.filter(c => c.id !== codeToDelete.id));
      setCodeToDelete(null);
      toast.success(french ? "Supprimé" : "Deleted");
    } catch { toast.error(french ? "Échec de la suppression" : "Failed to delete"); setCodeToDelete(null); }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
      .then(() => { setCopied(code); setTimeout(() => setCopied(null), 1500); })
      .catch(() => toast.error(french ? "Impossible de copier le code" : "Could not copy code"));
  }

  function fmtDiscount(pc: PromoCode) {
    return pc.discountType === "PERCENT" ? `${pc.discountValue}% ${french ? "de réduction" : "off"}` : `${formatCurrency(pc.discountValue)} ${french ? "de réduction" : "off"}`;
  }

  if (!bizId) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <ConfirmDialog
        open={codeToDelete !== null}
        title={french ? `Supprimer le code promo « ${codeToDelete?.code} »?` : `Delete promo code "${codeToDelete?.code}"?`}
        description={french ? "Les utilisations existantes restent comptabilisées, mais aucun nouvel échange ne sera accepté." : "Any existing uses are already counted but new redemptions will no longer work."}
        confirmLabel={french ? "Supprimer le code" : "Delete code"}
        variant="destructive"
        onConfirm={doRemove}
        onCancel={() => setCodeToDelete(null)}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Tag className="w-6 h-6 text-violet-600" /> {french ? "Codes promo" : "Promo Codes"}</h1>
          <p className="text-sm text-gray-500 mt-1">{french ? "Les clients les saisissent au paiement pour obtenir une réduction." : "Clients enter these at checkout to receive a discount."}</p>
        </div>
        <Button onClick={() => setShowForm(s => !s)} className="gap-2"><Plus className="w-4 h-4" /> {french ? "Nouveau code" : "New code"}</Button>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-gray-900">{french ? "Créer un code promo" : "Create promo code"}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Code</label>
              <Input placeholder={french ? "ex. ETE20" : "e.g. SUMMER20"} value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} className="uppercase" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{french ? "Type de réduction" : "Discount type"}</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.discountType} onChange={e => setForm(p => ({ ...p, discountType: e.target.value as "PERCENT" | "FLAT" }))}>
                <option value="PERCENT">{french ? "Pourcentage (%)" : "Percentage (%)"}</option>
                <option value="FLAT">{french ? "Montant fixe ($)" : "Flat amount ($)"}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{form.discountType === "PERCENT" ? (french ? "Pourcentage de réduction" : "Percentage off") : (french ? "Montant de réduction ($)" : "Amount off ($)")}</label>
              <Input type="number" min={1} max={form.discountType === "PERCENT" ? 100 : undefined} placeholder={form.discountType === "PERCENT" ? "20" : "10"} value={form.discountValue} onChange={e => setForm(p => ({ ...p, discountValue: e.target.value })) } />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{french ? "Utilisations max. (vide = illimité)" : "Max uses (blank = unlimited)"}</label>
              <Input type="number" min={1} placeholder={french ? "Illimité" : "Unlimited"} value={form.maxUsages} onChange={e => setForm(p => ({ ...p, maxUsages: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">{french ? "Date d’expiration (facultatif)" : "Expiry date (optional)"}</label>
              <Input type="date" value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit">{french ? "Créer" : "Create"}</Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>{french ? "Annuler" : "Cancel"}</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">{french ? "Chargement…" : "Loading…"}</div>
      ) : codes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{french ? "Aucun code promo" : "No promo codes yet"}</p>
          <p className="text-sm mt-1">{french ? "Créez-en un pour offrir des réductions sur Instagram, TikTok ou en personne." : "Create one to run discounts on Instagram, TikTok, or walk-ins."}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 shadow-sm">
          {codes.map(pc => (
            <div key={pc.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-gray-900">{pc.code}</span>
                  <button onClick={() => copyCode(pc.code)} className="text-gray-400 hover:text-violet-600">
                    {copied === pc.code ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  {!pc.active && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{french ? "Inactif" : "Inactive"}</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {fmtDiscount(pc)} · {pc.usageCount} {french ? "utilisations" : "uses"}{pc.maxUsages ? ` ${french ? "sur" : "of"} ${pc.maxUsages}` : ""}
                  {pc.expiresAt ? ` · ${french ? "expire le" : "expires"} ${formatDate(pc.expiresAt)}` : ""}
                </p>
              </div>
              <button onClick={() => toggle(pc)} aria-label={pc.active ? (french ? "Désactiver le code promo" : "Deactivate promo code") : (french ? "Activer le code promo" : "Activate promo code")} className="text-gray-400 hover:text-violet-600">
                {pc.active ? <ToggleRight className="w-5 h-5 text-violet-600" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => setCodeToDelete(pc)} aria-label={french ? "Supprimer le code promo" : "Delete promo code"} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
