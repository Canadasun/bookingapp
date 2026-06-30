"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Pencil, Trash2, Clock, DollarSign, Eye, EyeOff,
  FolderPlus, ChevronDown, ChevronRight, Tag, X, Check,
} from "lucide-react";
import { toast } from "sonner";
import { api, Service, ServiceCategory, Resource, ServiceLocationMode } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList } from "@/components/Skeleton";
import { formatPrice, cn } from "@/lib/utils";
import { OwnerOnly } from "@/components/OwnerOnly";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDashboardLocale } from "@/lib/dashboard-locale";
import { useLocationScope } from "@/lib/location-scope";

const COLORS = [
  "#E9A23C","#EFAA44","#8b5cf6","#ec4899","#f43f5e",
  "#f97316","#eab308","#22c55e","#14b8a6","#0ea5e9","#64748b",
];

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  return h > 0 ? `${h}h` : `${m}m`;
}

// Scrollable duration picker options (minutes) + a readable hours:minutes label.
const HOUR_OPTS = Array.from({ length: 13 }, (_, i) => i); // 0–12 hours
const MIN_OPTS = Array.from({ length: 60 }, (_, i) => i);  // 0–59 minutes
function fmtDurationLong(mins: number, labels: { hrShort: string; hrsShort: string; minShort: string }) {
  const h = Math.floor(mins / 60), m = mins % 60;
  const hLabel = h > 0 ? (h > 1 ? labels.hrsShort : labels.hrShort).replace("{count}", String(h)) : "";
  const mLabel = m > 0 ? labels.minShort.replace("{count}", String(m)) : "";
  return [hLabel, mLabel].filter(Boolean).join(" ") || labels.minShort.replace("{count}", String(mins));
}

// ── Service form modal ────────────────────────────────────────────────────────
interface ServiceFormState {
  name: string; description: string; durationMinutes: string;
  priceCents: string; priceType: "FLAT" | "PER_HOUR" | "STARTING_AT"; bufferBeforeMin: string; bufferAfterMin: string;
  capacity: string; resourceId: string;
  locationMode: ServiceLocationMode; virtualMeetingUrl: string;
  color: string; active: boolean; categoryId: string;
}
const EMPTY_SVC: ServiceFormState = {
  name: "", description: "", durationMinutes: "60", priceCents: "", priceType: "FLAT",
  bufferBeforeMin: "0", bufferAfterMin: "0", capacity: "1", resourceId: "",
  locationMode: "IN_PERSON", virtualMeetingUrl: "", color: "#E9A23C", active: true, categoryId: "",
};

// Labels and hints come from the dictionary (services.form.locationModes).
const LOCATION_MODES: { value: ServiceLocationMode }[] = [
  { value: "IN_PERSON" }, { value: "VIRTUAL" }, { value: "CUSTOMER" }, { value: "PHONE" },
];

function preferredPriceType(): ServiceFormState["priceType"] {
  if (typeof window === "undefined") return "FLAT";
  const value = window.localStorage.getItem("pulse.preferred-price-type.v1");
  return value === "PER_HOUR" || value === "STARTING_AT" ? value : "FLAT";
}

interface ServiceModalProps {
  bizId: string;
  editing: Service | null;
  categories: ServiceCategory[];
  resources: Resource[];
  onClose: () => void;
  onSaved: () => void;
}
function ServiceModal({ bizId, editing, categories, resources, onClose, onSaved }: ServiceModalProps) {
  const [form, setForm] = useState<ServiceFormState>(() =>
    editing ? {
      name: editing.name, description: editing.description ?? "",
      durationMinutes: String(editing.durationMinutes),
      priceCents: String(editing.priceCents / 100),
      priceType: editing.priceType ?? "FLAT",
      bufferBeforeMin: String(editing.bufferBeforeMin),
      bufferAfterMin: String(editing.bufferAfterMin),
      capacity: String(editing.capacity ?? 1),
      resourceId: editing.resourceId ?? "",
      locationMode: editing.locationMode ?? "IN_PERSON",
      virtualMeetingUrl: editing.virtualMeetingUrl ?? "",
      color: editing.color, active: editing.active,
      categoryId: editing.categoryId ?? "",
    } : { ...EMPTY_SVC, priceType: preferredPriceType() }
  );
  const [saving, setSaving] = useState(false);
  const { dictionary } = useDashboardLocale();
  const t = dictionary.services.form;
  const f = (k: keyof ServiceFormState, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    if (!form.name || !form.priceCents) { toast.error(t.nameAndPriceRequired); return; }
    if (Number(form.durationMinutes) < 1) { toast.error(t.setDuration); return; }
    if (!bizId) return;
    setSaving(true);
    try {
      const data = {
        name: form.name, description: form.description || undefined,
        durationMinutes: Number(form.durationMinutes),
        priceCents: Math.round(Number(form.priceCents) * 100),
        priceType: form.priceType,
        bufferBeforeMin: Number(form.bufferBeforeMin),
        bufferAfterMin: Number(form.bufferAfterMin),
        capacity: Math.max(1, Number(form.capacity) || 1),
        resourceId: form.resourceId || null,
        locationMode: form.locationMode,
        // Only meaningful for VIRTUAL; clear it otherwise so a mode switch
        // doesn't leave a stale link behind.
        virtualMeetingUrl: form.locationMode === "VIRTUAL" ? (form.virtualMeetingUrl.trim() || null) : null,
        color: form.color, active: form.active,
        sortOrder: editing?.sortOrder ?? 0,
        categoryId: form.categoryId || null,
      };
      if (editing) await api.services.update(bizId, editing.id, data);
      else await api.services.create(bizId, data);
      window.localStorage.setItem("pulse.preferred-price-type.v1", form.priceType);
      toast.success(editing ? t.serviceUpdated : t.serviceCreated);
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : t.saveFailed); }
    finally { setSaving(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-modal-title"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <Card className="dashboard-safe-bottom relative w-full max-w-md z-10 max-h-[90dvh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white flex items-center justify-between">
          <h3 id="service-modal-title" className="text-base font-semibold text-gray-900">{editing ? t.editTitle : t.newTitle}</h3>
          <button onClick={onClose} aria-label={t.closeAria}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <CardContent className="space-y-4 pt-4">

          {/* Category */}
          <div>
            <label htmlFor="svc-categoryId" className="block text-sm font-medium text-gray-700 mb-1.5">{t.category}</label>
            <select id="svc-categoryId" value={form.categoryId} onChange={e => f("categoryId", e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">{t.noCategory}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {[
            { k: "name",            label: t.name,        type: "text",   ph: t.namePlaceholder },
            { k: "description",     label: t.description, type: "text",   ph: t.descriptionPlaceholder },
          ].map(({ k, label, type, ph }) => (
            <div key={k}>
              <label htmlFor={`svc-${k}`} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <Input id={`svc-${k}`} type={type} placeholder={ph} value={form[k as keyof ServiceFormState] as string}
                onChange={e => f(k as keyof ServiceFormState, e.target.value)} />
            </div>
          ))}

          {/* Duration — pick hours and minutes separately (e.g. 1:15, 2:08) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.duration}</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <select
                  aria-label={t.durationHoursAria}
                  value={Math.floor(Number(form.durationMinutes || 0) / 60)}
                  onChange={e => f("durationMinutes", String(Number(e.target.value) * 60 + (Number(form.durationMinutes || 0) % 60)))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {HOUR_OPTS.map(h => <option key={h} value={h}>{(h === 1 ? t.hour : t.hours).replace("{count}", String(h))}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-600">{t.hoursLabel}</p>
              </div>
              <div>
                <select
                  aria-label={t.durationMinutesAria}
                  value={Number(form.durationMinutes || 0) % 60}
                  onChange={e => f("durationMinutes", String(Math.floor(Number(form.durationMinutes || 0) / 60) * 60 + Number(e.target.value)))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {MIN_OPTS.map(m => <option key={m} value={m}>{t.minuteOption.replace("{count}", String(m).padStart(2, "0"))}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-600">{t.minutesLabel}</p>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-violet-600 font-medium">{t.total.replace("{duration}", fmtDurationLong(Number(form.durationMinutes || 0), t))}</p>
          </div>

          <div>
            <label htmlFor="svc-priceCents" className="block text-sm font-medium text-gray-700 mb-1">{t.price}</label>
            <Input id="svc-priceCents" type="number" placeholder={t.pricePlaceholder} value={form.priceCents}
              onChange={e => f("priceCents", e.target.value)}
              min={0} step="0.01" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.pricingStyle}</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { value: "FLAT" as const, label: t.flat },
                { value: "PER_HOUR" as const, label: t.perHour },
                { value: "STARTING_AT" as const, label: t.startingAt },
              ].map((opt) => (
                <button key={opt.value} type="button" onClick={() => f("priceType", opt.value)}
                  className={cn("rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                    form.priceType === opt.value ? "border-violet-300 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-500 hover:bg-gray-50")}>
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-600">
              {t.pricingHint}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.delivery}</label>
            <div className="grid grid-cols-2 gap-2">
              {LOCATION_MODES.map((m) => (
                <button key={m.value} type="button" onClick={() => f("locationMode", m.value)}
                  aria-pressed={form.locationMode === m.value}
                  className={cn("rounded-xl border px-3 py-2 text-xs font-semibold text-left transition-colors",
                    form.locationMode === m.value ? "border-violet-300 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-500 hover:bg-gray-50")}>
                  {t.locationModes[m.value][0]}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-600">{t.locationModes[form.locationMode][1]}</p>
          </div>

          {form.locationMode === "VIRTUAL" && (
            <div>
              <label htmlFor="svc-virtualMeetingUrl" className="block text-sm font-medium text-gray-700 mb-1">{t.meetingLink}</label>
              <Input id="svc-virtualMeetingUrl" type="url" inputMode="url" placeholder={t.meetingPlaceholder}
                value={form.virtualMeetingUrl} onChange={e => f("virtualMeetingUrl", e.target.value)} />
              <p className="mt-1 text-xs text-gray-600">{t.meetingHint}</p>
            </div>
          )}

          {[
            { k: "bufferBeforeMin", label: t.bufferBefore, type: "number", ph: t.bufferPlaceholder },
            { k: "bufferAfterMin",  label: t.bufferAfter,  type: "number", ph: t.bufferPlaceholder },
          ].map(({ k, label, type, ph }) => (
            <div key={k}>
              <label htmlFor={`svc-${k}`} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <Input id={`svc-${k}`} type={type} placeholder={ph} value={form[k as keyof ServiceFormState] as string}
                onChange={e => f(k as keyof ServiceFormState, e.target.value)}
                min={0} />
            </div>
          ))}

          {/* Room / resource this service occupies */}
          {resources.length > 0 && (
            <div>
              <label htmlFor="svc-resourceId" className="block text-sm font-medium text-gray-700 mb-1.5">{t.room}</label>
              <select id="svc-resourceId" value={form.resourceId} onChange={e => f("resourceId", e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">{t.roomNone}</option>
                {resources.filter(r => r.active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-600">{t.roomHint}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.color}</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => f("color", c)}
                  aria-label={t.colorAria.replace("{color}", c) + (form.color === c ? t.colorSelected : "")}
                  aria-pressed={form.color === c}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                  style={{ background: c, outline: form.color === c ? `3px solid ${c}` : "none", outlineOffset: "2px" }}>
                  {form.color === c && <Check className="w-3 h-3 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={e => f("active", e.target.checked)} className="accent-violet-600 w-4 h-4" />
            <span className="text-sm text-gray-700">{t.active}</span>
          </label>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>{t.cancel}</Button>
            <Button className="flex-1" loading={saving} onClick={save}>{editing ? t.saveChanges : t.createService}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Category form modal ───────────────────────────────────────────────────────
const CAT_COLORS = ["#E9A23C","#EFAA44","#ec4899","#f43f5e","#f97316","#22c55e","#14b8a6","#0ea5e9","#64748b"];

interface CategoryModalProps {
  bizId: string;
  editing: ServiceCategory | null;
  onClose: () => void;
  onSaved: () => void;
}
function CategoryModal({ bizId, editing, onClose, onSaved }: CategoryModalProps) {
  const [name, setName] = useState(editing?.name ?? "");
  const [desc, setDesc] = useState(editing?.description ?? "");
  const [color, setColor] = useState(editing?.color ?? "#E9A23C");
  const [saving, setSaving] = useState(false);
  const { dictionary } = useDashboardLocale();
  const t = dictionary.services.category;

  async function save() {
    if (!name.trim()) { toast.error(t.nameRequired); return; }
    if (!bizId) return;
    setSaving(true);
    try {
      if (editing) await api.serviceCategories.update(bizId, editing.id, { name, description: desc || undefined, color });
      else await api.serviceCategories.create(bizId, { name, description: desc || undefined, color });
      toast.success(editing ? t.updated : t.created);
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : t.saveFailed); }
    finally { setSaving(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-modal-title"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <Card className="dashboard-safe-bottom relative w-full max-w-sm max-h-[90dvh] overflow-y-auto z-10">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 id="category-modal-title" className="text-base font-semibold text-gray-900">{editing ? t.editTitle : t.newTitle}</h3>
          <button onClick={onClose} aria-label={t.closeAria}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <CardContent className="space-y-4 pt-4">
          <div>
            <label htmlFor="cat-name" className="block text-sm font-medium text-gray-700 mb-1">{t.name}</label>
            <Input id="cat-name" placeholder={t.namePlaceholder} value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label htmlFor="cat-desc" className="block text-sm font-medium text-gray-700 mb-1">{t.description}</label>
            <Input id="cat-desc" placeholder={t.descriptionPlaceholder} value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.color}</label>
            <div className="flex gap-2 flex-wrap">
              {CAT_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  aria-label={t.colorAria.replace("{color}", c) + (color === c ? t.colorSelected : "")}
                  aria-pressed={color === c}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: c, outline: color === c ? `3px solid ${c}` : "none", outlineOffset: "2px" }}>
                  {color === c && <Check className="w-3 h-3 text-white" />}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={onClose}>{t.cancel}</Button>
            <Button className="flex-1" loading={saving} onClick={save}>{editing ? t.save : t.create}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ServicesPage() {
  const [services, setServices]     = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [resources, setResources]   = useState<Resource[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState("");
  const [collapsed, setCollapsed]   = useState<Record<string, boolean>>({});

  const [svcModal, setSvcModal]   = useState(false);
  const [editSvc, setEditSvc]     = useState<Service | null>(null);
  const [catModal, setCatModal]   = useState(false);
  const [editCat, setEditCat]     = useState<ServiceCategory | null>(null);
  const [resourceName, setResourceName] = useState("");
  const [showResources, setShowResources] = useState(false);
  const [editingResource, setEditingResource] = useState<{ id: string; name: string } | null>(null);
  const [savingResource, setSavingResource] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<ServiceCategory | null>(null);
  const [resourceToDelete, setResourceToDelete] = useState<Resource | null>(null);

  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";
  const { dictionary } = useDashboardLocale();
  const t = dictionary.services;
  const { selectedIds: scopedLocationIds, locations } = useLocationScope();
  const locationFilter = locations.length && scopedLocationIds.length < locations.length ? scopedLocationIds : undefined;

  const load = useCallback(async () => {
    if (!bizId) return;
    setLoadError("");
    setLoading(true);
    try {
      const [svcs, cats, res] = await Promise.all([
        api.services.listAll(bizId, locationFilter),
        api.serviceCategories.listAll(bizId),
        api.resources.list(bizId).catch(() => [] as Resource[]),
      ]);
      setServices(svcs);
      setCategories(cats);
      setResources(res);
    } catch (e) { setLoadError(e instanceof Error ? e.message : t.loadFailed); }
    finally { setLoading(false); }
  }, [bizId, t.loadFailed, locationFilter?.join(",")]);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(svc: Service) {
    if (!bizId) return;
    try { await api.services.update(bizId, svc.id, { active: !svc.active }); load(); }
    catch { toast.error(t.updateFailed); }
  }

  async function doDeleteService() {
    if (!bizId || !serviceToDelete) return;
    try {
      await api.services.remove(bizId, serviceToDelete.id);
      toast.success(t.serviceDeleted);
      setServiceToDelete(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.deleteFailed);
      setServiceToDelete(null);
    }
  }

  async function addResource() {
    const n = resourceName.trim();
    if (!n || !bizId) return;
    setSavingResource(true);
    try { await api.resources.create(bizId, { name: n }); setResourceName(""); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t.resources.addFailed); }
    finally { setSavingResource(false); }
  }
  async function doRemoveResource() {
    if (!bizId || !resourceToDelete) return;
    try { await api.resources.remove(bizId, resourceToDelete.id); setResourceToDelete(null); load(); }
    catch { toast.error(t.resources.deleteFailed); setResourceToDelete(null); }
  }
  async function toggleResourceActive(r: Resource) {
    if (!bizId) return;
    try { await api.resources.update(bizId, r.id, { active: !r.active }); load(); }
    catch { toast.error(t.updateFailed); }
  }
  async function saveResourceRename() {
    if (!editingResource || !bizId) return;
    const name = editingResource.name.trim();
    if (!name) return;
    setSavingResource(true);
    try { await api.resources.update(bizId, editingResource.id, { name }); setEditingResource(null); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t.resources.renameFailed); }
    finally { setSavingResource(false); }
  }

  async function doDeleteCategory() {
    if (!bizId || !categoryToDelete) return;
    try { await api.serviceCategories.remove(bizId, categoryToDelete.id); toast.success(t.categoryDeleted); setCategoryToDelete(null); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t.deleteFailed); setCategoryToDelete(null); }
  }

  // Group services: by category, then uncategorised
  const grouped = categories.map(cat => ({
    cat,
    svcs: services.filter(s => s.categoryId === cat.id),
  })).filter(g => g.svcs.length > 0);
  const uncategorised = services.filter(s => !s.categoryId);
  const totalActive = services.filter(s => s.active).length;

  return (
    <OwnerOnly>
      <ConfirmDialog
        open={serviceToDelete !== null}
        title={t.deleteServiceTitle.replace("{name}", serviceToDelete?.name ?? "")}
        description={t.deleteServiceDesc}
        confirmLabel={t.deleteServiceConfirm}
        variant="destructive"
        onConfirm={doDeleteService}
        onCancel={() => setServiceToDelete(null)}
      />
      <ConfirmDialog
        open={categoryToDelete !== null}
        title={t.deleteCategoryTitle.replace("{name}", categoryToDelete?.name ?? "")}
        description={t.deleteCategoryDesc}
        confirmLabel={t.deleteCategoryConfirm}
        variant="destructive"
        onConfirm={doDeleteCategory}
        onCancel={() => setCategoryToDelete(null)}
      />
      <ConfirmDialog
        open={resourceToDelete !== null}
        title={t.deleteResourceTitle.replace("{name}", resourceToDelete?.name ?? "")}
        description={t.deleteResourceDesc}
        confirmLabel={t.deleteResourceConfirm}
        variant="destructive"
        onConfirm={doRemoveResource}
        onCancel={() => setResourceToDelete(null)}
      />
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t.title}</h2>
            <p className="text-sm text-gray-500">
              {(categories.length !== 1 ? t.summaryPlural : t.summary).replace("{active}", String(totalActive)).replace("{count}", String(categories.length))}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setEditCat(null); setCatModal(true); }} className="gap-1.5">
              <FolderPlus className="w-4 h-4" /> {t.newCategory}
            </Button>
            <Button size="sm" onClick={() => { setEditSvc(null); setSvcModal(true); }} className="gap-1.5">
              <Plus className="w-4 h-4" /> {t.newService}
            </Button>
          </div>
        </div>

        {/* Rooms & resources */}
        <div className="mb-5 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <button onClick={() => setShowResources((s) => !s)}
            aria-label={showResources ? t.resources.hideAria : t.resources.manageAria}
            className="flex w-full items-center justify-between px-4 py-3 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{t.resources.title}</span>
              {resources.length > 0 && (
                <span className="text-xs bg-gray-100 text-gray-500 font-medium px-2 py-0.5 rounded-full">{resources.length}</span>
              )}
            </div>
            <span className="text-xs text-violet-600 font-medium">{showResources ? t.resources.hide : t.resources.manage}</span>
          </button>
          {showResources && (
            <div className="border-t border-gray-50">
              <p className="text-xs text-gray-600 px-4 pt-3 pb-2">
                {t.resources.intro}
              </p>

              {/* Resource list */}
              {resources.length > 0 && (
                <div className="divide-y divide-gray-50">
                  {resources.map((r) => {
                    const usedBy = services.filter(s => s.resourceId === r.id);
                    const isEditing = editingResource?.id === r.id;
                    return (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                        {/* Active dot */}
                        <div className={cn("w-2 h-2 rounded-full shrink-0", r.active ? "bg-emerald-400" : "bg-gray-300")} />

                        {/* Name / inline edit */}
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Input
                              autoFocus
                              value={editingResource.name}
                              onChange={(e) => setEditingResource({ ...editingResource, name: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); saveResourceRename(); }
                                if (e.key === "Escape") setEditingResource(null);
                              }}
                              className="h-7 text-sm py-0"
                            />
                            <button onClick={saveResourceRename} disabled={savingResource}
                              className="text-xs font-medium text-violet-600 hover:text-violet-800 shrink-0">
                              {savingResource ? t.resources.saving : t.resources.save}
                            </button>
                            <button onClick={() => setEditingResource(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 shrink-0">{t.resources.cancel}</button>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <span className={cn("text-sm font-medium", r.active ? "text-gray-900" : "text-gray-400 line-through")}>
                              {r.name}
                            </span>
                            {usedBy.length > 0 && (
                              <span className="ml-2 text-xs text-gray-500">
                                {(usedBy.length !== 1 ? t.resources.usedByPlural : t.resources.usedBy).replace("{count}", String(usedBy.length))}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        {!isEditing && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => toggleResourceActive(r)}
                              aria-label={r.active ? t.resources.deactivate : t.resources.activate}
                              className={cn(
                                "text-xs px-2 py-0.5 rounded-full border font-medium transition-colors",
                                r.active
                                  ? "text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                                  : "text-gray-500 border-gray-200 bg-gray-50 hover:bg-gray-100",
                              )}>
                              {r.active ? t.resources.active : t.resources.inactive}
                            </button>
                            <button
                              onClick={() => setEditingResource({ id: r.id, name: r.name })}
                              aria-label={t.resources.rename}
                              className="p-1 text-gray-400 hover:text-gray-700 rounded">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setResourceToDelete(r)}
                              aria-label={t.resources.delete}
                              className="p-1 text-gray-400 hover:text-red-600 rounded">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {resources.length === 0 && (
                <p className="px-4 pb-3 text-xs text-gray-600">{t.resources.empty}</p>
              )}

              {/* Add new resource */}
              <div className="flex gap-2 px-4 pb-4 pt-2 border-t border-gray-50">
                <Input
                  placeholder={t.resources.placeholder}
                  value={resourceName}
                  onChange={(e) => setResourceName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addResource(); } }}
                />
                <Button size="sm" onClick={addResource} disabled={!resourceName.trim() || savingResource}>
                  {savingResource ? t.resources.adding : t.resources.add}
                </Button>
              </div>
            </div>
          )}
        </div>

        {loadError ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-3">{loadError}</p>
            <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">{t.retry}</button>
          </div>
        ) : loading ? <SkeletonList rows={6} /> : services.length === 0 && categories.length === 0 ? (
          <EmptyState title={t.emptyTitle}
            description={t.emptyBody} />
        ) : (
          <div className="space-y-4">

            {/* Categories with their services */}
            {grouped.map(({ cat, svcs }) => {
              const isCollapsed = collapsed[cat.id];
              return (
                <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Category header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 bg-gray-50/60">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.color }} />
                    <button className="flex items-center gap-2 flex-1 text-left"
                      onClick={() => setCollapsed(p => ({ ...p, [cat.id]: !isCollapsed }))}>
                      <span className="text-sm font-bold text-gray-800">{cat.name}</span>
                      <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5">{svcs.length}</span>
                      {isCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5 text-gray-400 ml-auto" />
                        : <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />}
                    </button>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditCat(cat); setCatModal(true); }}
                        aria-label={t.editCategoryAria.replace("{name}", cat.name)}
                        className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setCategoryToDelete(cat)}
                        aria-label={t.deleteCategoryAria.replace("{name}", cat.name)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Services in category */}
                  {!isCollapsed && (
                    <div className="divide-y divide-gray-50">
                      {svcs.map(svc => (
                        <ServiceRow key={svc.id} svc={svc}
                          onEdit={() => { setEditSvc(svc); setSvcModal(true); }}
                          onToggle={() => toggleActive(svc)}
                          onDelete={() => setServiceToDelete(svc)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Uncategorised services */}
            {uncategorised.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 bg-gray-50/60">
                  <Tag className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm font-bold text-gray-500">{t.uncategorised}</span>
                  <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5">{uncategorised.length}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {uncategorised.map(svc => (
                    <ServiceRow key={svc.id} svc={svc}
                      onEdit={() => { setEditSvc(svc); setSvcModal(true); }}
                      onToggle={() => toggleActive(svc)}
                      onDelete={() => setServiceToDelete(svc)} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty categories */}
            {categories.filter(c => !grouped.find(g => g.cat.id === c.id)).map(cat => (
              <div key={cat.id} className="bg-white rounded-2xl border border-dashed border-gray-200 px-4 py-3 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.color }} />
                <span className="text-sm font-semibold text-gray-500">{cat.name}</span>
                <span className="text-xs text-gray-400">{t.empty}</span>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => { setEditCat(cat); setCatModal(true); }}
                    aria-label={`Edit ${cat.name} category`}
                    className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setCategoryToDelete(cat)}
                    aria-label={`Delete ${cat.name} category`}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {svcModal && (
        <ServiceModal
          bizId={bizId}
          editing={editSvc}
          categories={categories.filter(c => c.active)}
          resources={resources}
          onClose={() => setSvcModal(false)}
          onSaved={() => { setSvcModal(false); load(); }}
        />
      )}
      {catModal && (
        <CategoryModal
          bizId={bizId}
          editing={editCat}
          onClose={() => setCatModal(false)}
          onSaved={() => { setCatModal(false); load(); }}
        />
      )}
    </OwnerOnly>
  );
}

// ── Service row ───────────────────────────────────────────────────────────────
function ServiceRow({ svc, onEdit, onToggle, onDelete }: {
  svc: Service; onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const { dictionary } = useDashboardLocale();
  const t = dictionary.services.row;
  const priceLabel = svc.priceType === "STARTING_AT"
    ? t.startingAt.replace("{price}", formatPrice(svc.priceCents))
    : svc.priceType === "PER_HOUR"
      ? t.perHour.replace("{price}", formatPrice(svc.priceCents))
      : formatPrice(svc.priceCents);
  return (
    <div className={cn("flex items-center gap-4 px-4 py-3", !svc.active && "opacity-50")}>
      <div className="w-2.5 h-8 rounded-full shrink-0" style={{ background: svc.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-gray-900">{svc.name}</p>
          {!svc.active && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{t.archived}</span>}
        </div>
        {svc.description && <p className="text-xs text-gray-500 truncate mt-0.5">{svc.description}</p>}
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDuration(svc.durationMinutes)}</span>
          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{priceLabel}</span>
          {(svc.bufferBeforeMin > 0 || svc.bufferAfterMin > 0) && (
            <span>{t.buffer.replace("{before}", String(svc.bufferBeforeMin)).replace("{after}", String(svc.bufferAfterMin))}</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={onToggle}
          aria-label={(svc.active ? t.hideAria : t.showAria).replace("{name}", svc.name)}
          className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
          {svc.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button onClick={onEdit}
          className="p-2 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          aria-label={t.deleteAria.replace("{name}", svc.name)}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
