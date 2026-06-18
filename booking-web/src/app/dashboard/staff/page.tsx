"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Pencil, UserX, Check, ShieldCheck, CalendarClock, MessageCircle, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api, Service, StaffMember, Location, Business } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { ImageUpload } from "@/components/ImageUpload";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

const staffPermissionSummary = [
  { label: "Own schedule", icon: CalendarClock },
  { label: "Assigned services", icon: Check },
  { label: "Scoped messages", icon: MessageCircle },
];

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [biz, setBiz] = useState<Business | null>(null);
  const [locName, setLocName] = useState("");
  const [showLocations, setShowLocations] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locForm, setLocForm] = useState({ name: "", address: "", phone: "", timezone: "", active: true });
  const [savingLocation, setSavingLocation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<{ name: string; email: string; bio: string; avatarUrl: string; permissions: string[]; locationId: string }>({ name: "", email: "", bio: "", avatarUrl: "", permissions: [], locationId: "" });
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // One-time temp password to surface to the owner after inviting a staff member.
  const [invited, setInvited] = useState<{ email: string; password: string } | null>(null);
  const [staffToDeactivate, setStaffToDeactivate] = useState<StaffMember | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [staffDeleteWithMove, setStaffDeleteWithMove] = useState<{ member: StaffMember; msg: string } | null>(null);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);

  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";

  const load = useCallback(async () => {
    if (!bizId) {
      setLoading(false);
      return;
    }
    setLoadError("");
    setLoading(true);
    try {
      const [s, svcs, locs, b] = await Promise.all([
        api.staff.listAll(bizId),
        api.services.listAll(bizId),
        api.locations.list(bizId).catch(() => [] as Location[]),
        api.business.get(bizId).catch(() => null as Business | null),
      ]);
      setStaff(s); setServices(svcs.filter((sv) => sv.active)); setLocations(locs); setBiz(b);
    } catch (e) { setLoadError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm({ name:"", email:"", bio:"", avatarUrl:"", permissions:[], locationId:"" }); setSelectedServiceIds([]); setShowModal(true); }
  function openEdit(s: StaffMember) {
    setEditing(s);
    setForm({ name: s.user.name, email: s.user.email ?? "", bio: s.bio ?? "", avatarUrl: s.avatarUrl ?? "", permissions: s.permissions ?? [], locationId: s.locationId ?? "" });
    setSelectedServiceIds(s.staffServices.map((ss) => ss.serviceId));
    setShowModal(true);
  }

  async function save() {
    if (!form.name || !form.email) { toast.error("Name and email required"); return; }
    if (!bizId) return;
    setSaving(true);
    try {
      if (!editing) {
        // Owner-only invite: server creates the login + a one-time temp password.
        const res = await api.staff.invite(bizId, {
          name: form.name, email: form.email, bio: form.bio || undefined, serviceIds: selectedServiceIds,
        });
        // Invite can't carry an avatar/permissions — set them right after on the new staff record.
        if ((form.avatarUrl || form.permissions.length || form.locationId) && res.staff?.id) {
          await api.staff.update(bizId, res.staff.id, { avatarUrl: form.avatarUrl || undefined, permissions: form.permissions, locationId: form.locationId || null }).catch(() => {});
        }
        setInvited({ email: form.email, password: res.tempPassword });
        toast.success("Staff invited — copy the temporary password now");
      } else {
        await api.staff.update(bizId, editing.id, { bio: form.bio || undefined, avatarUrl: form.avatarUrl || "", permissions: form.permissions, locationId: form.locationId || null });
        await api.staff.assignServices(bizId, editing.id, selectedServiceIds);
        toast.success("Staff updated");
      }
      setShowModal(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function doDeactivate() {
    if (!bizId || !staffToDeactivate) return;
    try { await api.staff.update(bizId, staffToDeactivate.id, { active: false }); toast.success("Deactivated"); setStaffToDeactivate(null); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); setStaffToDeactivate(null); }
  }

  async function reactivate(s: StaffMember) {
    if (!bizId) return;
    try { await api.staff.update(bizId, s.id, { active: true }); toast.success("Reactivated"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  async function addLocation() {
    const n = locName.trim();
    if (!n || !bizId) return;
    try { await api.locations.create(bizId, { name: n }); setLocName(""); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to add"); }
  }

  function openEditLocation(l: Location) {
    setEditingLocation(l);
    setLocForm({ name: l.name, address: l.address ?? "", phone: l.phone ?? "", timezone: l.timezone ?? "", active: l.active });
  }

  async function saveLocation() {
    if (!editingLocation || !bizId) return;
    if (!locForm.name.trim()) { toast.error("Name required"); return; }
    setSavingLocation(true);
    try {
      await api.locations.update(bizId, editingLocation.id, {
        name: locForm.name.trim(),
        address: locForm.address.trim() || undefined,
        phone: locForm.phone.trim() || undefined,
        timezone: locForm.timezone.trim() || undefined,
        active: locForm.active,
      });
      setEditingLocation(null);
      load();
      toast.success("Location updated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSavingLocation(false); }
  }

  async function doRemoveLocation() {
    if (!bizId || !locationToDelete) return;
    try { await api.locations.remove(bizId, locationToDelete.id); setLocationToDelete(null); load(); }
    catch { toast.error("Failed to delete"); setLocationToDelete(null); }
  }

  async function doRemoveStaff() {
    if (!bizId || !staffToDelete) return;
    try {
      await api.staff.remove(bizId, staffToDelete.id);
      toast.success("Provider deleted");
      setStaffToDelete(null);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      if (/booking/i.test(msg)) {
        setStaffDeleteWithMove({ member: staffToDelete, msg });
        setStaffToDelete(null);
        return;
      }
      toast.error(msg);
      setStaffToDelete(null);
    }
  }

  async function doRemoveStaffWithMove() {
    if (!bizId || !staffDeleteWithMove) return;
    try {
      await api.staff.remove(bizId, staffDeleteWithMove.member.id, true);
      toast.success("Provider deleted — their bookings were moved to you");
      setStaffDeleteWithMove(null);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); setStaffDeleteWithMove(null); }
  }

  function toggleService(id: string) {
    setSelectedServiceIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  const isUnlimited = biz?.capabilities?.multipleLocations ?? (biz?.plan === "UNLIMITED");

  return (
    <div className="max-w-4xl mx-auto">
      <ConfirmDialog
        open={staffToDeactivate !== null}
        title={`Deactivate ${staffToDeactivate?.user.name}?`}
        description="They won't appear in the booking flow but their data and bookings are kept."
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={doDeactivate}
        onCancel={() => setStaffToDeactivate(null)}
      />
      <ConfirmDialog
        open={staffToDelete !== null}
        title={`Permanently delete ${staffToDelete?.user.name}?`}
        description="This removes their profile and login. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={doRemoveStaff}
        onCancel={() => setStaffToDelete(null)}
      />
      <ConfirmDialog
        open={staffDeleteWithMove !== null}
        title="Move bookings and delete?"
        description={staffDeleteWithMove?.msg ?? "This provider has existing bookings. Move them to you and delete this provider?"}
        confirmLabel="Move bookings and delete"
        variant="destructive"
        onConfirm={doRemoveStaffWithMove}
        onCancel={() => setStaffDeleteWithMove(null)}
      />
      <ConfirmDialog
        open={locationToDelete !== null}
        title={`Delete "${locationToDelete?.name}"?`}
        description="Staff assigned to this location will become unassigned."
        confirmLabel="Delete location"
        variant="destructive"
        onConfirm={doRemoveLocation}
        onCancel={() => setLocationToDelete(null)}
      />
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Staff</h2>
          <p className="text-sm text-gray-500">{staff.filter((s) => s.active).length} active · {staff.filter((s) => !s.active).length} inactive</p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4"/>Add staff</Button>
      </div>

      {invited && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">Temporary password for {invited.email}</p>
          <p className="text-xs text-amber-700 mb-2">Share it securely now — it won&apos;t be shown again. They&apos;ll be required to change it on first login.</p>
          <div className="flex items-center gap-2">
            <code className="font-mono font-bold bg-white px-2 py-1 rounded border border-amber-200">{invited.password}</code>
            <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard?.writeText(invited.password); toast.success("Copied"); }}>Copy</Button>
            <Button size="sm" variant="secondary" onClick={() => setInvited(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      {/* Locations / branches */}
      <div className="mb-5 rounded-2xl border border-gray-100 bg-white shadow-sm">
        <button onClick={() => setShowLocations((s) => !s)} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span className="text-sm font-semibold text-gray-900">Locations {locations.length > 0 && <span className="text-gray-400 font-normal">({locations.length})</span>}</span>
          <span className="text-xs text-violet-600 font-medium">{showLocations ? "Hide" : "Manage"}</span>
        </button>
        {showLocations && (
          <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
            <p className="text-xs text-gray-600">Add branches, then assign each staff member to one. Clients booking a location only see that location&apos;s providers. Single-location businesses can leave this empty.</p>
            {locations.map((l) => {
              const staffCount = staff.filter((s) => s.locationId === l.id).length;
              return (
                <div key={l.id} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{l.name}</p>
                      {!l.active && <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">inactive</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 mt-0.5">
                      {l.address && <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3"/>{l.address}</p>}
                      {l.phone && <p className="text-xs text-gray-500">{l.phone}</p>}
                      {l.timezone && <p className="text-xs text-gray-400">{l.timezone}</p>}
                      <p className="text-xs text-gray-400">{staffCount} staff</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditLocation(l)} className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors" aria-label="Edit"><Pencil className="w-3.5 h-3.5"/></button>
                    <button onClick={() => setLocationToDelete(l)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors" aria-label="Delete location"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              );
            })}
            {locations.length === 0 && <p className="text-xs text-gray-400">No locations yet.</p>}
            {!isUnlimited && locations.length >= 1 ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                Multiple locations require the Unlimited plan.{" "}
                <a href="/dashboard/settings#billing" className="underline font-medium">Upgrade</a>
              </p>
            ) : (
              <>
                <div className="flex gap-2 pt-1">
                  <Input placeholder="e.g. Downtown · West End" value={locName}
                    onChange={(e) => setLocName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLocation(); } }} />
                  <Button size="sm" onClick={addLocation} disabled={!locName.trim()}>Add</Button>
                </div>
                <p className="text-xs text-gray-400">Add address, phone, and timezone via Edit after creating.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Location edit modal */}
      {editingLocation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="location-modal-title"
          tabIndex={-1}
          onKeyDown={(e) => e.key === "Escape" && setEditingLocation(null)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={() => setEditingLocation(null)} />
          <Card className="dashboard-safe-bottom relative w-full max-w-sm max-h-[92dvh] overflow-y-auto z-10">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 id="location-modal-title" className="font-semibold text-gray-900">Edit location</h3>
            </div>
            <CardContent className="space-y-3 pt-4">
              <div>
                <label htmlFor="loc-name" className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <Input id="loc-name" autoFocus value={locForm.name} onChange={(e) => setLocForm((p) => ({ ...p, name: e.target.value }))} placeholder="Downtown" />
              </div>
              <div>
                <label htmlFor="loc-address" className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                <Input id="loc-address" value={locForm.address} onChange={(e) => setLocForm((p) => ({ ...p, address: e.target.value }))} placeholder="123 Main St" />
              </div>
              <div>
                <label htmlFor="loc-phone" className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <Input id="loc-phone" value={locForm.phone} onChange={(e) => setLocForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 555 000 0000" />
              </div>
              <div>
                <label htmlFor="loc-timezone" className="block text-xs font-medium text-gray-700 mb-1">Timezone</label>
                <select id="loc-timezone" value={locForm.timezone} onChange={(e) => setLocForm((p) => ({ ...p, timezone: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">— Same as business —</option>
                  <option value="America/Vancouver">Pacific — Vancouver, Kelowna (PT)</option>
                  <option value="America/Edmonton">Mountain — Edmonton, Calgary (MT)</option>
                  <option value="America/Regina">Saskatchewan — Regina (CT, no DST)</option>
                  <option value="America/Winnipeg">Central — Winnipeg (CT)</option>
                  <option value="America/Toronto">Eastern — Toronto, Ottawa (ET)</option>
                  <option value="America/Halifax">Atlantic — Halifax, Moncton (AT)</option>
                  <option value="America/St_Johns">Newfoundland — St. John&apos;s (NT)</option>
                </select>
                <p className="mt-1 text-xs text-gray-400">Slot generation uses this timezone for staff at this location.</p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5">
                <span className="text-sm text-gray-700">Active</span>
                <button type="button" onClick={() => setLocForm((p) => ({ ...p, active: !p.active }))}
                  aria-label="Toggle active"
                  className={cn("relative w-9 h-5 rounded-full transition-colors shrink-0", locForm.active ? "bg-violet-600" : "bg-gray-200")}>
                  <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", locForm.active ? "translate-x-4" : "translate-x-0.5")} />
                </button>
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="secondary" className="flex-1" onClick={() => setEditingLocation(null)}>Cancel</Button>
                <Button className="flex-1" loading={savingLocation} onClick={saveLocation}>Save</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loadError ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3">{loadError}</p>
          <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">Retry</button>
        </div>
      ) : loading ? <LoadingSpinner /> : staff.length === 0 ? <EmptyState title="No staff yet" /> : (
        <div className="space-y-3">
          {staff.map((s) => (
            <Card key={s.id} className={!s.active ? "opacity-60" : ""}>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="relative w-10 h-10 rounded-full bg-violet-100 overflow-hidden flex items-center justify-center text-violet-700 font-semibold text-sm shrink-0">
                  {s.avatarUrl
                    ? <Image src={s.avatarUrl} alt={`${s.user.name} profile photo`} fill className="object-cover" />
                    : initials(s.user.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{s.user.name}</p>
                    {!s.active && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">inactive</span>}
                    {s.locationId && (() => { const loc = locations.find((l) => l.id === s.locationId); return loc ? <span className="inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full"><MapPin className="w-3 h-3"/>{loc.name}</span> : null; })()}
                  </div>
                  {s.user.email && <p className="text-xs text-gray-500">{s.user.email}</p>}
                  {s.staffServices.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {s.staffServices.map((ss) => {
                        const name = ss.service?.name ?? services.find((sv) => sv.id === ss.serviceId)?.name;
                        return name ? (
                          <span key={ss.serviceId} className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">{name}</span>
                        ) : null;
                      })}
                    </div>
                  )}
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {staffPermissionSummary.map(({ label, icon: Icon }) => (
                      <span key={label} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <Icon className="h-3 w-3" />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Link href={`/dashboard/staff/${s.id}`} aria-label={`View ${s.user.name}'s schedule`}><Button size="sm" variant="ghost" className="text-xs">Schedule</Button></Link>
                  <button onClick={() => openEdit(s)} aria-label="Edit" className="p-2 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors"><Pencil className="w-4 h-4"/></button>
                  {s.active
                    ? <button onClick={() => setStaffToDeactivate(s)} aria-label="Deactivate" className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"><UserX className="w-4 h-4"/></button>
                    : <button onClick={() => reactivate(s)} aria-label="Reactivate" className="p-2 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"><Check className="w-4 h-4"/></button>
                  }
                  <button onClick={() => setStaffToDelete(s)} aria-label="Delete" className="p-2 text-gray-400 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4"/></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-modal-title"
          tabIndex={-1}
          onKeyDown={(e) => e.key === "Escape" && setShowModal(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={() => setShowModal(false)} />
          <Card className="dashboard-safe-bottom relative w-full max-w-md z-10 max-h-[90dvh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 id="staff-modal-title" className="font-semibold text-gray-900">{editing ? `Edit ${editing.user.name}` : "Add staff member"}</h3>
            </div>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="staff-name" className="block text-sm font-medium text-gray-700 mb-1">Full name *</label>
                <Input id="staff-name" autoFocus placeholder="Jane Smith" value={form.name} disabled={!!editing} onChange={(e) => setForm((p) => ({...p,name:e.target.value}))}/>
              </div>
              <div>
                <label htmlFor="staff-email" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <Input id="staff-email" type="email" placeholder="jane@salon.com" value={form.email} disabled={!!editing} onChange={(e) => setForm((p) => ({...p,email:e.target.value}))}/>
              </div>
              <div>
                <label htmlFor="staff-bio" className="block text-sm font-medium text-gray-700 mb-1">Bio (optional)</label>
                <Input id="staff-bio" placeholder="Specialises in…" value={form.bio} onChange={(e) => setForm((p) => ({...p,bio:e.target.value}))}/>
              </div>
              <div>
                <label htmlFor="staff-avatar" className="block text-sm font-medium text-gray-700 mb-2">Photo (optional)</label>
                <ImageUpload value={form.avatarUrl || null} kind="AVATAR" shape="circle"
                  onChange={(url) => setForm((p) => ({ ...p, avatarUrl: url ?? "" }))} />
              </div>
              {locations.filter((l) => l.active).length > 0 && (
                <div>
                  <label htmlFor="staff-location" className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
                  <select id="staff-location" value={form.locationId} onChange={(e) => setForm((p) => ({ ...p, locationId: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">— Any / unassigned —</option>
                    {locations.filter((l) => l.active).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-gray-600">Clients booking this location only see providers assigned to it.</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <p className="text-xs text-gray-400 -mt-1 mb-2">Owners have full access. Grant this staff member extra access below.</p>
                <div className="space-y-1.5">
                  {([
                    { key: "VIEW_MONEY", label: "View money", desc: "See the payments ledger & reports" },
                    { key: "MANAGE_SERVICES", label: "Manage services", desc: "Add and edit services" },
                    { key: "MANAGE_STAFF", label: "Manage staff", desc: "Invite and edit team members" },
                  ] as const).map((p) => {
                    const on = form.permissions.includes(p.key);
                    return (
                      <button key={p.key} type="button"
                        aria-label={`Toggle ${p.label}`}
                        aria-pressed={on}
                        onClick={() => setForm((f) => ({ ...f, permissions: on ? f.permissions.filter((x) => x !== p.key) : [...f.permissions, p.key] }))}
                        className={cn("flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                          on ? "border-violet-200 bg-violet-50" : "border-gray-200 hover:bg-gray-50")}>
                        <span>
                          <span className={cn("block text-sm font-medium", on ? "text-violet-700" : "text-gray-700")}>{p.label}</span>
                          <span className="block text-xs text-gray-400">{p.desc}</span>
                        </span>
                        <span className={cn("relative w-9 h-5 rounded-full transition-colors shrink-0", on ? "bg-violet-600" : "bg-gray-200")}>
                          <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", on ? "translate-x-4" : "translate-x-0.5")} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Services offered</label>
                {services.length === 0 ? (
                  <p className="text-xs text-gray-400">Create active services first.</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-100 rounded-xl p-2">
                    {services.map((svc) => (
                      <label key={svc.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded-lg">
                        <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                          selectedServiceIds.includes(svc.id) ? "bg-violet-600 border-violet-600" : "border-gray-300")}>
                          {selectedServiceIds.includes(svc.id) && <Check className="w-3 h-3 text-white"/>}
                        </div>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{background:svc.color}}/>
                        <span className="text-sm text-gray-700">{svc.name}</span>
                        <input type="checkbox" className="sr-only" checked={selectedServiceIds.includes(svc.id)} onChange={() => toggleService(svc.id)}/>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                  <ShieldCheck className="h-4 w-4" />
                  Staff access
                </div>
                <div className="mt-2 grid gap-1.5 text-xs text-emerald-800">
                  <p>Staff accounts are limited to this business.</p>
                  <p>Owner-only settings, billing, and staff management stay protected.</p>
                  <p>Booking access follows assigned services and availability.</p>
                </div>
              </div>
              {!editing && (
                <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                  A one-time temporary password will be generated. The staff member must set their own password on first sign-in.
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button className="flex-1" loading={saving} onClick={save}>{editing ? "Save" : "Add"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
