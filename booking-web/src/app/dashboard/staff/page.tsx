"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Pencil, UserX, Check, ShieldCheck, CalendarClock, MessageCircle, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api, Service, StaffMember, Location } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { ImageUpload } from "@/components/ImageUpload";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

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
  const [locName, setLocName] = useState("");
  const [showLocations, setShowLocations] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locForm, setLocForm] = useState({ name: "", address: "", phone: "", timezone: "", active: true });
  const [savingLocation, setSavingLocation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<{ name: string; email: string; bio: string; avatarUrl: string; permissions: string[]; locationId: string }>({ name: "", email: "", bio: "", avatarUrl: "", permissions: [], locationId: "" });
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // One-time temp password to surface to the owner after inviting a staff member.
  const [invited, setInvited] = useState<{ email: string; password: string } | null>(null);

  const user = getUser();
  const bizId = user?.businessId ?? "";

  const load = useCallback(async () => {
    if (!bizId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [s, svcs, locs] = await Promise.all([
        api.staff.listAll(bizId),
        api.services.listAll(bizId),
        api.locations.list(bizId).catch(() => [] as Location[]),
      ]);
      setStaff(s); setServices(svcs.filter((sv) => sv.active)); setLocations(locs);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
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

  async function deactivate(s: StaffMember) {
    if (!bizId) return;
    if (!confirm(`Deactivate ${s.user.name}?`)) return;
    try { await api.staff.update(bizId, s.id, { active: false }); toast.success("Deactivated"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
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

  async function removeLocation(l: Location) {
    if (!bizId) return;
    if (!confirm(`Delete "${l.name}"? Staff there become unassigned.`)) return;
    try { await api.locations.remove(bizId, l.id); load(); }
    catch { toast.error("Failed to delete"); }
  }

  async function removeStaff(s: StaffMember) {
    if (!bizId) return;
    if (!confirm(`Permanently delete ${s.user.name}? This removes their profile and login.`)) return;
    try {
      await api.staff.remove(bizId, s.id);
      toast.success("Provider deleted");
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      // If blocked only because they still have bookings, offer to move those
      // bookings to the owner and delete anyway.
      if (/booking/i.test(msg)) {
        if (confirm(msg)) {
          try {
            await api.staff.remove(bizId, s.id, true);
            toast.success("Provider deleted — their bookings were moved to you");
            load();
          } catch (e2) { toast.error(e2 instanceof Error ? e2.message : "Failed"); }
        }
        return;
      }
      toast.error(msg);
    }
  }

  function toggleService(id: string) {
    setSelectedServiceIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
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
            <p className="text-xs text-gray-400">Add branches, then assign each staff member to one. Clients booking a location only see that location&apos;s providers. Single-location businesses can leave this empty.</p>
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
                    <button onClick={() => openEditLocation(l)} className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5"/></button>
                    <button onClick={() => removeLocation(l)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              );
            })}
            {locations.length === 0 && <p className="text-xs text-gray-400">No locations yet.</p>}
            <div className="flex gap-2 pt-1">
              <Input placeholder="e.g. Downtown · West End" value={locName}
                onChange={(e) => setLocName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLocation(); } }} />
              <Button size="sm" onClick={addLocation} disabled={!locName.trim()}>Add</Button>
            </div>
          </div>
        )}
      </div>

      {/* Location edit modal */}
      {editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingLocation(null)} />
          <Card className="relative w-full max-w-sm z-10">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Edit location</h3>
            </div>
            <CardContent className="space-y-3 pt-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <Input value={locForm.name} onChange={(e) => setLocForm((p) => ({ ...p, name: e.target.value }))} placeholder="Downtown" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                <Input value={locForm.address} onChange={(e) => setLocForm((p) => ({ ...p, address: e.target.value }))} placeholder="123 Main St" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <Input value={locForm.phone} onChange={(e) => setLocForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 555 000 0000" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Timezone</label>
                <Input value={locForm.timezone} onChange={(e) => setLocForm((p) => ({ ...p, timezone: e.target.value }))} placeholder="America/Toronto" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5">
                <span className="text-sm text-gray-700">Active</span>
                <button type="button" onClick={() => setLocForm((p) => ({ ...p, active: !p.active }))}
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

      {loading ? <LoadingSpinner /> : staff.length === 0 ? <EmptyState title="No staff yet" /> : (
        <div className="space-y-3">
          {staff.map((s) => (
            <Card key={s.id} className={!s.active ? "opacity-60" : ""}>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-violet-100 overflow-hidden flex items-center justify-center text-violet-700 font-semibold text-sm shrink-0">
                  {s.avatarUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={s.avatarUrl} alt="" className="w-full h-full object-cover" />
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
                  <Link href={`/dashboard/staff/${s.id}`}><Button size="sm" variant="ghost" className="text-xs">Schedule</Button></Link>
                  <button onClick={() => openEdit(s)} className="p-2 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors"><Pencil className="w-4 h-4"/></button>
                  {s.active
                    ? <button onClick={() => deactivate(s)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors" title="Deactivate"><UserX className="w-4 h-4"/></button>
                    : <button onClick={() => reactivate(s)} className="p-2 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors" title="Reactivate"><Check className="w-4 h-4"/></button>
                  }
                  <button onClick={() => removeStaff(s)} className="p-2 text-gray-400 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors" title="Delete provider"><Trash2 className="w-4 h-4"/></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <Card className="relative w-full max-w-md z-10 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editing ? `Edit ${editing.user.name}` : "Add staff member"}</h3>
            </div>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name *</label>
                <Input placeholder="Jane Smith" value={form.name} disabled={!!editing} onChange={(e) => setForm((p) => ({...p,name:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <Input type="email" placeholder="jane@salon.com" value={form.email} disabled={!!editing} onChange={(e) => setForm((p) => ({...p,email:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio (optional)</label>
                <Input placeholder="Specialises in…" value={form.bio} onChange={(e) => setForm((p) => ({...p,bio:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Photo (optional)</label>
                <ImageUpload value={form.avatarUrl || null} kind="AVATAR" shape="circle"
                  onChange={(url) => setForm((p) => ({ ...p, avatarUrl: url ?? "" }))} />
              </div>
              {locations.filter((l) => l.active).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
                  <select value={form.locationId} onChange={(e) => setForm((p) => ({ ...p, locationId: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">— Any / unassigned —</option>
                    {locations.filter((l) => l.active).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">Clients booking this location only see providers assigned to it.</p>
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
