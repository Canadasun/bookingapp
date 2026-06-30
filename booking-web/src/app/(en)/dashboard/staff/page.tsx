"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Pencil, UserX, Check, ShieldCheck, CalendarClock, MessageCircle, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api, Service, StaffMember, Location } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { useLocationScope } from "@/lib/location-scope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { ImageUpload } from "@/components/ImageUpload";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDashboardLocale } from "@/lib/dashboard-locale";

const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

// Labels come from the dictionary (staff.permSummary), aligned to this icon order.
const staffPermissionIcons = [CalendarClock, Check, MessageCircle];

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  // When a single branch is focused in the location switcher, show only its providers.
  const { selectedIds: scopedIds, locations: scopeLocs } = useLocationScope();
  const scopedLocationId = scopeLocs.length > 1 && scopedIds.length === 1 ? scopedIds[0] : undefined;
  const visibleStaff = scopedLocationId ? staff.filter((s) => s.locationId === scopedLocationId) : staff;
  const scopedLocationName = scopedLocationId ? (scopeLocs.find((l) => l.id === scopedLocationId)?.name ?? null) : null;
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

  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";
  const { dictionary } = useDashboardLocale();
  const t = dictionary.staff;

  const load = useCallback(async () => {
    if (!bizId) {
      setLoading(false);
      return;
    }
    setLoadError("");
    setLoading(true);
    try {
      const [s, svcs, locs] = await Promise.all([
        api.staff.listAll(bizId),
        api.services.listAll(bizId),
        api.locations.list(bizId).catch(() => [] as Location[]),
      ]);
      setStaff(s); setServices(svcs.filter((sv) => sv.active)); setLocations(locs);
    } catch (e) { setLoadError(e instanceof Error ? e.message : t.loadFailed); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!form.name || !form.email) { toast.error(t.toasts.nameEmailRequired); return; }
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
        toast.success(t.toasts.invited);
      } else {
        await api.staff.update(bizId, editing.id, { bio: form.bio || undefined, avatarUrl: form.avatarUrl || "", permissions: form.permissions, locationId: form.locationId || null });
        await api.staff.assignServices(bizId, editing.id, selectedServiceIds);
        toast.success(t.toasts.updated);
      }
      setShowModal(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.saveFailed); }
    finally { setSaving(false); }
  }

  async function doDeactivate() {
    if (!bizId || !staffToDeactivate) return;
    try { await api.staff.update(bizId, staffToDeactivate.id, { active: false }); toast.success(t.toasts.deactivated); setStaffToDeactivate(null); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.failed); setStaffToDeactivate(null); }
  }

  async function reactivate(s: StaffMember) {
    if (!bizId) return;
    try { await api.staff.update(bizId, s.id, { active: true }); toast.success(t.toasts.reactivated); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.failed); }
  }

  async function doRemoveStaff() {
    if (!bizId || !staffToDelete) return;
    try {
      await api.staff.remove(bizId, staffToDelete.id);
      toast.success(t.toasts.deleted);
      setStaffToDelete(null);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.toasts.failed;
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
      toast.success(t.toasts.deletedMoved);
      setStaffDeleteWithMove(null);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.failed); setStaffDeleteWithMove(null); }
  }

  function toggleService(id: string) {
    setSelectedServiceIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <ConfirmDialog
        open={staffToDeactivate !== null}
        title={t.confirm.deactivateTitle.replace("{name}", staffToDeactivate?.user.name ?? "")}
        description={t.confirm.deactivateDesc}
        confirmLabel={t.confirm.deactivate}
        variant="destructive"
        onConfirm={doDeactivate}
        onCancel={() => setStaffToDeactivate(null)}
      />
      <ConfirmDialog
        open={staffToDelete !== null}
        title={t.confirm.deleteTitle.replace("{name}", staffToDelete?.user.name ?? "")}
        description={t.confirm.deleteDesc}
        confirmLabel={t.confirm.delete}
        variant="destructive"
        onConfirm={doRemoveStaff}
        onCancel={() => setStaffToDelete(null)}
      />
      <ConfirmDialog
        open={staffDeleteWithMove !== null}
        title={t.confirm.moveTitle}
        description={staffDeleteWithMove?.msg ?? t.confirm.moveDescFallback}
        confirmLabel={t.confirm.move}
        variant="destructive"
        onConfirm={doRemoveStaffWithMove}
        onCancel={() => setStaffDeleteWithMove(null)}
      />
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{t.title}</h2>
          <p className="text-sm text-gray-500">
            {t.summary.replace("{active}", String(visibleStaff.filter((s) => s.active).length)).replace("{inactive}", String(visibleStaff.filter((s) => !s.active).length))}
            {scopedLocationName && <span className="text-violet-600">{t.scopedOnly.replace("{name}", scopedLocationName)}</span>}
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4"/>{t.addStaff}</Button>
      </div>

      {invited && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">{t.invite.title.replace("{email}", invited.email)}</p>
          <p className="text-xs text-amber-700 mb-2">{t.invite.note}</p>
          <div className="flex items-center gap-2">
            <code className="font-mono font-bold bg-white px-2 py-1 rounded border border-amber-200">{invited.password}</code>
            <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard?.writeText(invited.password); toast.success(t.toasts.copied); }}>{t.invite.copy}</Button>
            <Button size="sm" variant="secondary" onClick={() => setInvited(null)}>{t.invite.dismiss}</Button>
          </div>
        </div>
      )}

      {locations.length > 0 && (
        <Link href="/dashboard/locations" className="mb-5 flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm hover:border-violet-200 transition-colors">
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <MapPin className="w-4 h-4 text-indigo-500" />
            {t.locations} <span className="text-gray-400 font-normal">({locations.length})</span>
          </span>
          <span className="text-xs text-violet-600 font-medium">{t.manage}</span>
        </Link>
      )}

      {loadError ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3">{loadError}</p>
          <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">{t.retry}</button>
        </div>
      ) : loading ? <LoadingSpinner /> : staff.length === 0 ? <EmptyState title={t.emptyTitle} icon={ShieldCheck} description={t.emptyBody} /> : visibleStaff.length === 0 ? (
        <EmptyState title={t.noProvidersTitle.replace("{location}", scopedLocationName ?? t.thisLocation)} icon={ShieldCheck} description={t.noProvidersBody} />
      ) : (
        <div className="space-y-3">
          {visibleStaff.map((s) => (
            <Card key={s.id} className={!s.active ? "opacity-60" : ""}>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="relative w-10 h-10 rounded-full bg-violet-100 overflow-hidden flex items-center justify-center text-violet-700 font-semibold text-sm shrink-0">
                  {s.avatarUrl
                    ? <Image src={s.avatarUrl} alt={t.profilePhotoAlt.replace("{name}", s.user.name)} fill className="object-cover" />
                    : initials(s.user.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{s.user.name}</p>
                    {!s.active && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{t.inactive}</span>}
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
                    {staffPermissionIcons.map((Icon, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <Icon className="h-3 w-3" />
                        {t.permSummary[i]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Link href={`/dashboard/staff/${s.id}`} aria-label={t.scheduleAria.replace("{name}", s.user.name)}><Button size="sm" variant="ghost" className="text-xs">{t.schedule}</Button></Link>
                  <button onClick={() => openEdit(s)} aria-label={t.editAria} className="p-2 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors"><Pencil className="w-4 h-4"/></button>
                  {s.active
                    ? <button onClick={() => setStaffToDeactivate(s)} aria-label={t.deactivateAria} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"><UserX className="w-4 h-4"/></button>
                    : <button onClick={() => reactivate(s)} aria-label={t.reactivateAria} className="p-2 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"><Check className="w-4 h-4"/></button>
                  }
                  <button onClick={() => setStaffToDelete(s)} aria-label={t.deleteAria} className="p-2 text-gray-400 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4"/></button>
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
              <h3 id="staff-modal-title" className="font-semibold text-gray-900">{editing ? t.modal.editTitle.replace("{name}", editing.user.name) : t.modal.newTitle}</h3>
            </div>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="staff-name" className="block text-sm font-medium text-gray-700 mb-1">{t.modal.name}</label>
                <Input id="staff-name" autoFocus placeholder={t.modal.namePlaceholder} value={form.name} disabled={!!editing} onChange={(e) => setForm((p) => ({...p,name:e.target.value}))}/>
              </div>
              <div>
                <label htmlFor="staff-email" className="block text-sm font-medium text-gray-700 mb-1">{t.modal.email}</label>
                <Input id="staff-email" type="email" placeholder={t.modal.emailPlaceholder} value={form.email} disabled={!!editing} onChange={(e) => setForm((p) => ({...p,email:e.target.value}))}/>
              </div>
              <div>
                <label htmlFor="staff-bio" className="block text-sm font-medium text-gray-700 mb-1">{t.modal.bio}</label>
                <Input id="staff-bio" placeholder={t.modal.bioPlaceholder} value={form.bio} onChange={(e) => setForm((p) => ({...p,bio:e.target.value}))}/>
              </div>
              <div>
                <label htmlFor="staff-avatar" className="block text-sm font-medium text-gray-700 mb-2">{t.modal.photo}</label>
                <ImageUpload value={form.avatarUrl || null} kind="AVATAR" shape="circle"
                  onChange={(url) => setForm((p) => ({ ...p, avatarUrl: url ?? "" }))} />
              </div>
              {locations.filter((l) => l.active).length > 0 && (
                <div>
                  <label htmlFor="staff-location" className="block text-sm font-medium text-gray-700 mb-1.5">{t.modal.location}</label>
                  <select id="staff-location" value={form.locationId} onChange={(e) => setForm((p) => ({ ...p, locationId: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">{t.modal.locationAny}</option>
                    {locations.filter((l) => l.active).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-gray-600">{t.modal.locationHint}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.modal.permissions}</label>
                <p className="text-xs text-gray-400 -mt-1 mb-2">{t.modal.permissionsHint}</p>
                <div className="space-y-1.5">
                  {(["VIEW_MONEY", "MANAGE_SERVICES", "MANAGE_STAFF"] as const).map((key) => {
                    const on = form.permissions.includes(key);
                    const [label, desc] = t.modal.perms[key];
                    return (
                      <button key={key} type="button"
                        aria-label={t.modal.toggleAria.replace("{label}", label)}
                        aria-pressed={on}
                        onClick={() => setForm((f) => ({ ...f, permissions: on ? f.permissions.filter((x) => x !== key) : [...f.permissions, key] }))}
                        className={cn("flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                          on ? "border-violet-200 bg-violet-50" : "border-gray-200 hover:bg-gray-50")}>
                        <span>
                          <span className={cn("block text-sm font-medium", on ? "text-violet-700" : "text-gray-700")}>{label}</span>
                          <span className="block text-xs text-gray-400">{desc}</span>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.modal.servicesOffered}</label>
                {services.length === 0 ? (
                  <p className="text-xs text-gray-400">{t.modal.noServices}</p>
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
                  {t.modal.accessTitle}
                </div>
                <div className="mt-2 grid gap-1.5 text-xs text-emerald-800">
                  {t.modal.accessLines.map((line, i) => <p key={i}>{line}</p>)}
                </div>
              </div>
              {!editing && (
                <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                  {t.modal.tempPasswordNote}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>{t.modal.cancel}</Button>
                <Button className="flex-1" loading={saving} onClick={save}>{editing ? t.modal.save : t.modal.add}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
