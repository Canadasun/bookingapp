"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, MapPin, Building2, CalendarDays, Users } from "lucide-react";
import { toast } from "sonner";
import { api, Location, StaffMember, Business } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { notifyLocationsChanged, useLocationScope } from "@/lib/location-scope";
import { useDashboardLocale } from "@/lib/dashboard-locale";
import { CA_TAX, caRateForProvince } from "@/lib/ca-tax";

// Canadian timezones offered for a location. Slot generation uses the
// location's timezone (falling back to the business timezone) so a branch in
// another province shows the correct local hours.
const TIMEZONES = [
  ["America/Vancouver", "Pacific — Vancouver, Kelowna (PT)"],
  ["America/Edmonton", "Mountain — Edmonton, Calgary (MT)"],
  ["America/Regina", "Saskatchewan — Regina (CT, no DST)"],
  ["America/Winnipeg", "Central — Winnipeg (CT)"],
  ["America/Toronto", "Eastern — Toronto, Ottawa (ET)"],
  ["America/Halifax", "Atlantic — Halifax, Moncton (AT)"],
  ["America/St_Johns", "Newfoundland — St. John's (NT)"],
] as const;

type LocForm = { name: string; address: string; phone: string; timezone: string; active: boolean; taxProvince: string; taxRatePercent: string; depositMode: "" | "on" | "off"; depositPercent: string; cancellationWindowMinutes: string; cancellationPolicy: string };
const emptyForm: LocForm = { name: "", address: "", phone: "", timezone: "", active: true, taxProvince: "", taxRatePercent: "", depositMode: "", depositPercent: "", cancellationWindowMinutes: "", cancellationPolicy: "" };

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [biz, setBiz] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LocForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Location | null>(null);

  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";
  const router = useRouter();
  const { setSelectedIds } = useLocationScope();
  const { french } = useDashboardLocale();

  // Focus the whole dashboard on one branch and open its calendar.
  function openBranchCalendar(id: string) {
    setSelectedIds([id]);
    router.push("/dashboard/appointments");
  }

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoadError("");
    setLoading(true);
    try {
      const [locs, s, b] = await Promise.all([
        api.locations.list(bizId),
        api.staff.listAll(bizId).catch(() => [] as StaffMember[]),
        api.business.get(bizId).catch(() => null as Business | null),
      ]);
      setLocations(locs); setStaff(s); setBiz(b);
    } catch (e) { setLoadError(e instanceof Error ? e.message : (french ? "Échec du chargement" : "Failed to load")); }
    finally { setLoading(false); }
  }, [bizId, french]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditingId(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(l: Location) {
    setEditingId(l.id);
    setForm({ name: l.name, address: l.address ?? "", phone: l.phone ?? "", timezone: l.timezone ?? "", active: l.active,
      taxProvince: l.taxProvince ?? "", taxRatePercent: l.taxRatePercent != null ? String(l.taxRatePercent) : "",
      depositMode: l.requireDeposit == null ? "" : l.requireDeposit ? "on" : "off",
      depositPercent: l.depositPercent != null ? String(l.depositPercent) : "",
      cancellationWindowMinutes: l.cancellationWindowMinutes != null ? String(l.cancellationWindowMinutes) : "",
      cancellationPolicy: l.cancellationPolicy ?? "" });
    setModalOpen(true);
  }

  async function save() {
    if (!bizId) return;
    if (!form.name.trim()) { toast.error(french ? "Le nom est requis" : "Name required"); return; }
    const taxProvince = form.taxProvince || null;
    const taxRatePercent = form.taxRatePercent.trim() === "" ? null : Number(form.taxRatePercent);
    if (taxRatePercent != null && (Number.isNaN(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100)) {
      toast.error(french ? "Taux de taxe invalide" : "Invalid tax rate"); return;
    }
    // Deposit: "" = inherit business default (null); "on"/"off" = branch override.
    const requireDeposit = form.depositMode === "" ? null : form.depositMode === "on";
    const depositPercent = form.depositMode === "on" && form.depositPercent.trim() !== "" ? Number(form.depositPercent) : null;
    if (depositPercent != null && (Number.isNaN(depositPercent) || depositPercent < 1 || depositPercent > 100)) {
      toast.error(french ? "Pourcentage de dépôt invalide" : "Invalid deposit percent"); return;
    }
    const cancellationWindowMinutes = form.cancellationWindowMinutes.trim() === "" ? null : Number(form.cancellationWindowMinutes);
    if (cancellationWindowMinutes != null && (!Number.isInteger(cancellationWindowMinutes) || cancellationWindowMinutes < 0 || cancellationWindowMinutes > 525600)) {
      toast.error(french ? "Délai d’annulation invalide" : "Invalid cancellation window"); return;
    }
    const cancellationPolicy = form.cancellationPolicy.trim() || null;
    setSaving(true);
    try {
      if (editingId) {
        await api.locations.update(bizId, editingId, {
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          timezone: form.timezone.trim() || undefined,
          active: form.active,
          taxProvince,
          taxRatePercent,
          requireDeposit,
          depositPercent,
          cancellationWindowMinutes,
          cancellationPolicy,
        });
        toast.success(french ? "Emplacement mis à jour" : "Location updated");
      } else {
        await api.locations.create(bizId, {
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          timezone: form.timezone.trim() || undefined,
          taxProvince,
          taxRatePercent,
          requireDeposit,
          depositPercent,
          cancellationWindowMinutes,
          cancellationPolicy,
        });
        toast.success(french ? "Emplacement ajouté" : "Location added");
      }
      setModalOpen(false);
      notifyLocationsChanged();
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : (french ? "Échec de l’enregistrement" : "Save failed")); }
    finally { setSaving(false); }
  }

  async function doRemove() {
    if (!bizId || !toDelete) return;
    try { await api.locations.remove(bizId, toDelete.id); toast.success(french ? "Emplacement supprimé" : "Location deleted"); setToDelete(null); notifyLocationsChanged(); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : (french ? "Échec de la suppression" : "Failed to delete")); setToDelete(null); }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <ConfirmDialog
        open={toDelete !== null}
        title={french ? `Supprimer « ${toDelete?.name} »?` : `Delete "${toDelete?.name}"?`}
        description={french ? "Le personnel et les rendez-vous attribués à cet emplacement deviendront non attribués. Cette action est irréversible." : "Staff and appointments assigned to this location become unassigned. This cannot be undone."}
        confirmLabel={french ? "Supprimer l’emplacement" : "Delete location"}
        variant="destructive"
        onConfirm={doRemove}
        onCancel={() => setToDelete(null)}
      />

      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{french ? "Emplacements" : "Locations"}</h2>
          <p className="text-sm text-gray-500">{french ? "Gérez vos succursales. Les clients ne voient que les professionnels affectés à l’emplacement choisi." : "Manage your branches. Clients booking a location only see providers assigned to it."}</p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4"/>{french ? "Ajouter un emplacement" : "Add location"}</Button>
      </div>

      {!loading && !loadError && locations.length > 0 && (
        <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/60 p-3 text-xs leading-relaxed text-violet-800">
          {french ? <>Ouvrez une succursale ci-dessous pour accéder directement à son calendrier. Affectez chaque professionnel à une succursale depuis la page <Link href="/dashboard/staff" className="font-semibold underline">Personnel</Link> — les clients qui réservent à cet emplacement ne voient que les professionnels qui y travaillent.</> : <>Open a branch below to jump straight to its calendar. Assign each provider to a branch on the <Link href="/dashboard/staff" className="font-semibold underline">Staff</Link> page — clients booking that location only see providers who work there.</>}
        </div>
      )}

      {loadError ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3">{loadError}</p>
          <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">{french ? "Réessayer" : "Retry"}</button>
        </div>
      ) : loading ? <LoadingSpinner /> : locations.length === 0 ? (
        <EmptyState
          title={french ? "Aucun emplacement" : "No locations yet"}
          icon={Building2}
          description={french ? "Ajoutez une succursale pour affecter du personnel et laisser les clients choisir où réserver. Les entreprises à emplacement unique peuvent ignorer ceci — les réservations utilisent votre adresse principale." : "Add a branch to assign staff and let clients pick where they book. Single-location businesses can skip this — bookings just use your main address."}
        />
      ) : (
        <div className="space-y-3">
          {locations.map((l) => {
            const staffCount = staff.filter((s) => s.locationId === l.id).length;
            return (
              <Card key={l.id} className={l.active ? "" : "opacity-60"}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                      <MapPin className="w-5 h-5"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{l.name}</p>
                        {!l.active && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{french ? "inactif" : "inactive"}</span>}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {l.address && <p className="text-xs text-gray-500">{l.address}</p>}
                        {l.phone && <p className="text-xs text-gray-500">{l.phone}</p>}
                        {l.timezone && <p className="text-xs text-gray-400">{l.timezone}</p>}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{french ? `${staffCount} ${staffCount === 1 ? "professionnel affecté" : "professionnels affectés"}` : `${staffCount} ${staffCount === 1 ? "provider" : "providers"} assigned`}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(l)} className="p-2 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors" aria-label={french ? "Modifier" : "Edit"}><Pencil className="w-4 h-4"/></button>
                      <button onClick={() => setToDelete(l)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors" aria-label={french ? "Supprimer l’emplacement" : "Delete location"}><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                    <button
                      type="button"
                      onClick={() => openBranchCalendar(l.id)}
                      disabled={!l.active}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                    >
                      <CalendarDays className="w-3.5 h-3.5"/>{french ? "Ouvrir le calendrier de cette succursale" : "Open this branch's calendar"}
                    </button>
                    <Link
                      href="/dashboard/staff"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      <Users className="w-3.5 h-3.5"/>{french ? "Affecter du personnel" : "Assign staff"}
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <p className="text-xs text-gray-400 px-1">{french ? <>Affectez chaque professionnel à un emplacement depuis la page <Link href="/dashboard/staff" className="text-violet-600 hover:underline">Personnel</Link>.</> : <>Assign each provider to a location from the <Link href="/dashboard/staff" className="text-violet-600 hover:underline">Staff</Link> page.</>}</p>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="location-modal-title"
          tabIndex={-1}
          onKeyDown={(e) => e.key === "Escape" && setModalOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={() => setModalOpen(false)} />
          <Card className="dashboard-safe-bottom relative w-full max-w-sm max-h-[92dvh] overflow-y-auto z-10">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 id="location-modal-title" className="font-semibold text-gray-900">{editingId ? (french ? "Modifier l’emplacement" : "Edit location") : (french ? "Ajouter un emplacement" : "Add location")}</h3>
            </div>
            <CardContent className="space-y-3 pt-4">
              <div>
                <label htmlFor="loc-name" className="block text-xs font-medium text-gray-700 mb-1">{french ? "Nom *" : "Name *"}</label>
                <Input id="loc-name" autoFocus value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder={french ? "Centre-ville · Ouest" : "Downtown · West End"} />
              </div>
              <div>
                <label htmlFor="loc-address" className="block text-xs font-medium text-gray-700 mb-1">{french ? "Adresse" : "Address"}</label>
                <Input id="loc-address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder={french ? "123, rue Principale" : "123 Main St"} />
              </div>
              <div>
                <label htmlFor="loc-phone" className="block text-xs font-medium text-gray-700 mb-1">{french ? "Téléphone" : "Phone"}</label>
                <Input id="loc-phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 555 000 0000" />
              </div>
              <div>
                <label htmlFor="loc-timezone" className="block text-xs font-medium text-gray-700 mb-1">{french ? "Fuseau horaire" : "Timezone"}</label>
                <select id="loc-timezone" value={form.timezone} onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">{french ? "— Identique à l’entreprise —" : "— Same as business —"}</option>
                  {TIMEZONES.map(([tz, label]) => <option key={tz} value={tz}>{label}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-400">{french ? "La génération des créneaux utilise ce fuseau horaire pour le personnel de cet emplacement." : "Slot generation uses this timezone for staff at this location."}</p>
              </div>
              <div>
                <label htmlFor="loc-tax" className="block text-xs font-medium text-gray-700 mb-1">{french ? "Province (taxe)" : "Tax province"}</label>
                <select id="loc-tax" value={form.taxProvince}
                  onChange={(e) => {
                    const code = e.target.value;
                    const rate = caRateForProvince(code);
                    setForm((p) => ({ ...p, taxProvince: code, taxRatePercent: rate != null ? String(rate) : p.taxRatePercent }));
                  }}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">{french ? "— Identique à l’entreprise —" : "— Same as business —"}</option>
                  {CA_TAX.map((p) => <option key={p.code} value={p.code}>{p.label} — {p.rate}%</option>)}
                </select>
                <div className="mt-2 flex items-center gap-2">
                  <Input id="loc-tax-rate" type="number" step="0.001" min="0" max="100" value={form.taxRatePercent}
                    onChange={(e) => setForm((p) => ({ ...p, taxRatePercent: e.target.value }))}
                    placeholder={french ? "Taux %" : "Rate %"} className="max-w-28" />
                  <span className="text-xs text-gray-400">{french ? "% appliqué aux factures de cette succursale (sinon celui de l’entreprise)." : "% applied to this branch's invoices (else the business rate)."}</span>
                </div>
              </div>
              <div>
                <label htmlFor="loc-deposit" className="block text-xs font-medium text-gray-700 mb-1">{french ? "Dépôt" : "Deposit"}</label>
                <select id="loc-deposit" value={form.depositMode}
                  onChange={(e) => setForm((p) => ({ ...p, depositMode: e.target.value as LocForm["depositMode"] }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">{french ? "— Paramètre de l’entreprise —" : "— Business default —"}</option>
                  <option value="on">{french ? "Exiger un dépôt" : "Require a deposit"}</option>
                  <option value="off">{french ? "Aucun dépôt" : "No deposit"}</option>
                </select>
                {form.depositMode === "on" && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input id="loc-deposit-pct" type="number" min="1" max="100" step="1" value={form.depositPercent}
                      onChange={(e) => setForm((p) => ({ ...p, depositPercent: e.target.value }))}
                      placeholder={french ? "% dépôt" : "Deposit %"} className="max-w-28" />
                    <span className="text-xs text-gray-400">{french ? "% du prix (sinon celui de l’entreprise)." : "% of the price (else the business default)."}</span>
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="loc-cancel-window" className="block text-xs font-medium text-gray-700 mb-1">{french ? "Délai d’annulation (minutes)" : "Cancellation window (minutes)"}</label>
                <Input id="loc-cancel-window" type="number" min="0" max="525600" step="1"
                  value={form.cancellationWindowMinutes}
                  onChange={(e) => setForm((p) => ({ ...p, cancellationWindowMinutes: e.target.value }))}
                  placeholder={french ? "Paramètre de l’entreprise" : "Business default"} />
              </div>
              <div>
                <label htmlFor="loc-cancel-policy" className="block text-xs font-medium text-gray-700 mb-1">{french ? "Politique d’annulation" : "Cancellation policy"}</label>
                <textarea id="loc-cancel-policy" rows={3} maxLength={5000}
                  value={form.cancellationPolicy}
                  onChange={(e) => setForm((p) => ({ ...p, cancellationPolicy: e.target.value }))}
                  placeholder={french ? "Vide = politique de l’entreprise" : "Blank = business policy"}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5">
                <span className="text-sm text-gray-700">{french ? "Actif" : "Active"}</span>
                <button type="button" onClick={() => setForm((p) => ({ ...p, active: !p.active }))}
                  aria-label={french ? "Activer/désactiver" : "Toggle active"} aria-pressed={form.active}
                  className={cn("relative w-9 h-5 rounded-full transition-colors shrink-0", form.active ? "bg-violet-600" : "bg-gray-200")}>
                  <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", form.active ? "translate-x-4" : "translate-x-0.5")} />
                </button>
              </div>
              {!biz?.capabilities?.multipleLocations && biz?.plan !== "UNLIMITED" && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  {french ? <>Votre forfait limite le nombre d’emplacements que vous pouvez ajouter.{" "}<a href="/dashboard/settings#billing" className="underline font-medium">Mettez à niveau</a> pour plus de succursales.</> : <>Your plan limits how many locations you can add.{" "}<a href="/dashboard/settings#billing" className="underline font-medium">Upgrade</a> for more branches.</>}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>{french ? "Annuler" : "Cancel"}</Button>
                <Button className="flex-1" loading={saving} onClick={save}>{editingId ? (french ? "Enregistrer" : "Save") : (french ? "Ajouter" : "Add")}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
