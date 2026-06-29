"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, MapPin, Building2 } from "lucide-react";
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
import { notifyLocationsChanged } from "@/lib/location-scope";

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

type LocForm = { name: string; address: string; phone: string; timezone: string; active: boolean };
const emptyForm: LocForm = { name: "", address: "", phone: "", timezone: "", active: true };

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
    } catch (e) { setLoadError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditingId(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(l: Location) {
    setEditingId(l.id);
    setForm({ name: l.name, address: l.address ?? "", phone: l.phone ?? "", timezone: l.timezone ?? "", active: l.active });
    setModalOpen(true);
  }

  async function save() {
    if (!bizId) return;
    if (!form.name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.locations.update(bizId, editingId, {
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          timezone: form.timezone.trim() || undefined,
          active: form.active,
        });
        toast.success("Location updated");
      } else {
        await api.locations.create(bizId, {
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          timezone: form.timezone.trim() || undefined,
        });
        toast.success("Location added");
      }
      setModalOpen(false);
      notifyLocationsChanged();
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function doRemove() {
    if (!bizId || !toDelete) return;
    try { await api.locations.remove(bizId, toDelete.id); toast.success("Location deleted"); setToDelete(null); notifyLocationsChanged(); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to delete"); setToDelete(null); }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.name}"?`}
        description="Staff and appointments assigned to this location become unassigned. This cannot be undone."
        confirmLabel="Delete location"
        variant="destructive"
        onConfirm={doRemove}
        onCancel={() => setToDelete(null)}
      />

      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Locations</h2>
          <p className="text-sm text-gray-500">Manage your branches. Clients booking a location only see providers assigned to it.</p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4"/>Add location</Button>
      </div>

      {loadError ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3">{loadError}</p>
          <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">Retry</button>
        </div>
      ) : loading ? <LoadingSpinner /> : locations.length === 0 ? (
        <EmptyState
          title="No locations yet"
          icon={Building2}
          description="Add a branch to assign staff and let clients pick where they book. Single-location businesses can skip this — bookings just use your main address."
        />
      ) : (
        <div className="space-y-3">
          {locations.map((l) => {
            const staffCount = staff.filter((s) => s.locationId === l.id).length;
            return (
              <Card key={l.id} className={l.active ? "" : "opacity-60"}>
                <CardContent className="py-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    <MapPin className="w-5 h-5"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{l.name}</p>
                      {!l.active && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">inactive</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {l.address && <p className="text-xs text-gray-500">{l.address}</p>}
                      {l.phone && <p className="text-xs text-gray-500">{l.phone}</p>}
                      {l.timezone && <p className="text-xs text-gray-400">{l.timezone}</p>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{staffCount} {staffCount === 1 ? "provider" : "providers"} assigned</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(l)} className="p-2 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors" aria-label="Edit"><Pencil className="w-4 h-4"/></button>
                    <button onClick={() => setToDelete(l)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors" aria-label="Delete location"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <p className="text-xs text-gray-400 px-1">Assign each provider to a location from the <Link href="/dashboard/staff" className="text-violet-600 hover:underline">Staff</Link> page.</p>
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
              <h3 id="location-modal-title" className="font-semibold text-gray-900">{editingId ? "Edit location" : "Add location"}</h3>
            </div>
            <CardContent className="space-y-3 pt-4">
              <div>
                <label htmlFor="loc-name" className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <Input id="loc-name" autoFocus value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Downtown · West End" />
              </div>
              <div>
                <label htmlFor="loc-address" className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                <Input id="loc-address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="123 Main St" />
              </div>
              <div>
                <label htmlFor="loc-phone" className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <Input id="loc-phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 555 000 0000" />
              </div>
              <div>
                <label htmlFor="loc-timezone" className="block text-xs font-medium text-gray-700 mb-1">Timezone</label>
                <select id="loc-timezone" value={form.timezone} onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">— Same as business —</option>
                  {TIMEZONES.map(([tz, label]) => <option key={tz} value={tz}>{label}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-400">Slot generation uses this timezone for staff at this location.</p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5">
                <span className="text-sm text-gray-700">Active</span>
                <button type="button" onClick={() => setForm((p) => ({ ...p, active: !p.active }))}
                  aria-label="Toggle active" aria-pressed={form.active}
                  className={cn("relative w-9 h-5 rounded-full transition-colors shrink-0", form.active ? "bg-violet-600" : "bg-gray-200")}>
                  <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", form.active ? "translate-x-4" : "translate-x-0.5")} />
                </button>
              </div>
              {!biz?.capabilities?.multipleLocations && biz?.plan !== "UNLIMITED" && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Your plan limits how many locations you can add.{" "}
                  <a href="/dashboard/settings#billing" className="underline font-medium">Upgrade</a> for more branches.
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button className="flex-1" loading={saving} onClick={save}>{editingId ? "Save" : "Add"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
