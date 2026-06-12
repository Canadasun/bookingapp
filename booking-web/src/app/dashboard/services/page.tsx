"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Pencil, Trash2, Clock, DollarSign, Eye, EyeOff,
  FolderPlus, ChevronDown, ChevronRight, Tag, X, Check,
} from "lucide-react";
import { toast } from "sonner";
import { api, Service, ServiceCategory, Resource } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList } from "@/components/Skeleton";
import { formatPrice, cn } from "@/lib/utils";
import { OwnerOnly } from "@/components/OwnerOnly";

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
function fmtDurationLong(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60;
  const hLabel = h > 0 ? `${h} hr${h > 1 ? "s" : ""}` : "";
  const mLabel = m > 0 ? `${m} min` : "";
  return [hLabel, mLabel].filter(Boolean).join(" ") || `${mins} min`;
}

// ── Service form modal ────────────────────────────────────────────────────────
interface ServiceFormState {
  name: string; description: string; durationMinutes: string;
  priceCents: string; priceType: "FLAT" | "PER_HOUR" | "STARTING_AT"; bufferBeforeMin: string; bufferAfterMin: string;
  capacity: string; resourceId: string;
  color: string; active: boolean; categoryId: string;
}
const EMPTY_SVC: ServiceFormState = {
  name: "", description: "", durationMinutes: "60", priceCents: "", priceType: "FLAT",
  bufferBeforeMin: "0", bufferAfterMin: "0", capacity: "1", resourceId: "", color: "#E9A23C", active: true, categoryId: "",
};

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
      color: editing.color, active: editing.active,
      categoryId: editing.categoryId ?? "",
    } : { ...EMPTY_SVC, priceType: preferredPriceType() }
  );
  const [saving, setSaving] = useState(false);
  const f = (k: keyof ServiceFormState, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    if (!form.name || !form.priceCents) { toast.error("Name and price are required"); return; }
    if (Number(form.durationMinutes) < 1) { toast.error("Set how long the service takes"); return; }
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
        color: form.color, active: form.active,
        sortOrder: editing?.sortOrder ?? 0,
        categoryId: form.categoryId || null,
      };
      if (editing) await api.services.update(bizId, editing.id, data);
      else await api.services.create(bizId, data);
      window.localStorage.setItem("pulse.preferred-price-type.v1", form.priceType);
      toast.success(editing ? "Service updated" : "Service created");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-modal-title"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <Card className="relative w-full max-w-md z-10 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white flex items-center justify-between">
          <h3 id="service-modal-title" className="text-base font-semibold text-gray-900">{editing ? "Edit service" : "New service"}</h3>
          <button onClick={onClose} aria-label="Close dialog"><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <CardContent className="space-y-4 pt-4">

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <select value={form.categoryId} onChange={e => f("categoryId", e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">— No category —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {[
            { k: "name",            label: "Service name *",     type: "text",   ph: "e.g. Full groom · Lash fill · Cut & style" },
            { k: "description",     label: "Description",        type: "text",   ph: "Optional detail" },
          ].map(({ k, label, type, ph }) => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <Input type={type} placeholder={ph} value={form[k as keyof ServiceFormState] as string}
                onChange={e => f(k as keyof ServiceFormState, e.target.value)} />
            </div>
          ))}

          {/* Duration — pick hours and minutes separately (e.g. 1:15, 2:08) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">How long does it take?</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <select
                  aria-label="Duration hours"
                  value={Math.floor(Number(form.durationMinutes || 0) / 60)}
                  onChange={e => f("durationMinutes", String(Number(e.target.value) * 60 + (Number(form.durationMinutes || 0) % 60)))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {HOUR_OPTS.map(h => <option key={h} value={h}>{h} hour{h === 1 ? "" : "s"}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-600">Hours</p>
              </div>
              <div>
                <select
                  aria-label="Duration minutes"
                  value={Number(form.durationMinutes || 0) % 60}
                  onChange={e => f("durationMinutes", String(Math.floor(Number(form.durationMinutes || 0) / 60) * 60 + Number(e.target.value)))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {MIN_OPTS.map(m => <option key={m} value={m}>{String(m).padStart(2, "0")} min</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-600">Minutes</p>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-violet-600 font-medium">Total: {fmtDurationLong(Number(form.durationMinutes || 0))}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
            <Input type="number" placeholder="45.00" value={form.priceCents}
              onChange={e => f("priceCents", e.target.value)}
              min={0} step="0.01" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pricing style</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "FLAT" as const, label: "Flat rate" },
                { value: "PER_HOUR" as const, label: "Per hour" },
                { value: "STARTING_AT" as const, label: "Starting at" },
              ].map((opt) => (
                <button key={opt.value} type="button" onClick={() => f("priceType", opt.value)}
                  className={cn("rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                    form.priceType === opt.value ? "border-violet-300 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-500 hover:bg-gray-50")}>
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-600">
              Use starting at when the final amount may change after seeing the client, pet, or job.
            </p>
          </div>

          {[
            { k: "bufferBeforeMin", label: "Buffer before (min)", type: "number", ph: "0" },
            { k: "bufferAfterMin",  label: "Buffer after (min)",  type: "number", ph: "0" },
          ].map(({ k, label, type, ph }) => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <Input type={type} placeholder={ph} value={form[k as keyof ServiceFormState] as string}
                onChange={e => f(k as keyof ServiceFormState, e.target.value)}
                min={0} />
            </div>
          ))}

          {/* Room / resource this service occupies */}
          {resources.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Room / resource</label>
              <select value={form.resourceId} onChange={e => f("resourceId", e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">— None —</option>
                {resources.filter(r => r.active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-600">If set, the slot is blocked whenever this resource is already in use.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => f("color", c)}
                  aria-label={`Select color ${c}${form.color === c ? " (selected)" : ""}`}
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
            <span className="text-sm text-gray-700">Active — visible in booking flow</span>
          </label>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={save}>{editing ? "Save changes" : "Create service"}</Button>
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

  async function save() {
    if (!name.trim()) { toast.error("Category name is required"); return; }
    if (!bizId) return;
    setSaving(true);
    try {
      if (editing) await api.serviceCategories.update(bizId, editing.id, { name, description: desc || undefined, color });
      else await api.serviceCategories.create(bizId, { name, description: desc || undefined, color });
      toast.success(editing ? "Category updated" : "Category created");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-modal-title"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <Card className="relative w-full max-w-sm z-10">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 id="category-modal-title" className="text-base font-semibold text-gray-900">{editing ? "Edit category" : "New category"}</h3>
          <button onClick={onClose} aria-label="Close dialog"><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <CardContent className="space-y-4 pt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category name *</label>
            <Input placeholder="e.g. Hair Services" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Input placeholder="Optional" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {CAT_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  aria-label={`Select color ${c}${color === c ? " (selected)" : ""}`}
                  aria-pressed={color === c}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: c, outline: color === c ? `3px solid ${c}` : "none", outlineOffset: "2px" }}>
                  {color === c && <Check className="w-3 h-3 text-white" />}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={save}>{editing ? "Save" : "Create"}</Button>
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

  const user = getUser();
  const bizId = user?.businessId ?? "";

  const load = useCallback(async () => {
    if (!bizId) return;
    setLoadError("");
    setLoading(true);
    try {
      const [svcs, cats, res] = await Promise.all([
        api.services.listAll(bizId),
        api.serviceCategories.listAll(bizId),
        api.resources.list(bizId).catch(() => [] as Resource[]),
      ]);
      setServices(svcs);
      setCategories(cats);
      setResources(res);
    } catch (e) { setLoadError(e instanceof Error ? e.message : "Failed to load services"); }
    finally { setLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(svc: Service) {
    if (!bizId) return;
    try { await api.services.update(bizId, svc.id, { active: !svc.active }); load(); }
    catch { toast.error("Failed to update"); }
  }

  async function deleteService(svc: Service) {
    if (!bizId) return;
    if (!confirm(`Delete "${svc.name}"? This cannot be undone.`)) return;
    try {
      await api.services.remove(bizId, svc.id);
      toast.success("Service deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function addResource() {
    const n = resourceName.trim();
    if (!n || !bizId) return;
    setSavingResource(true);
    try { await api.resources.create(bizId, { name: n }); setResourceName(""); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to add"); }
    finally { setSavingResource(false); }
  }
  async function removeResource(r: Resource) {
    if (!bizId) return;
    if (!confirm(`Delete "${r.name}"? Services using it will lose their room assignment.`)) return;
    try { await api.resources.remove(bizId, r.id); load(); }
    catch { toast.error("Failed to delete"); }
  }
  async function toggleResourceActive(r: Resource) {
    if (!bizId) return;
    try { await api.resources.update(bizId, r.id, { active: !r.active }); load(); }
    catch { toast.error("Failed to update"); }
  }
  async function saveResourceRename() {
    if (!editingResource || !bizId) return;
    const name = editingResource.name.trim();
    if (!name) return;
    setSavingResource(true);
    try { await api.resources.update(bizId, editingResource.id, { name }); setEditingResource(null); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to rename"); }
    finally { setSavingResource(false); }
  }

  async function deleteCategory(cat: ServiceCategory) {
    if (!bizId) return;
    if (!confirm(`Delete "${cat.name}"? Services in this category will become uncategorised.`)) return;
    try { await api.serviceCategories.remove(bizId, cat.id); toast.success("Category deleted"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
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
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Services</h2>
            <p className="text-sm text-gray-500">
              {totalActive} active · {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setEditCat(null); setCatModal(true); }} className="gap-1.5">
              <FolderPlus className="w-4 h-4" /> New category
            </Button>
            <Button size="sm" onClick={() => { setEditSvc(null); setSvcModal(true); }} className="gap-1.5">
              <Plus className="w-4 h-4" /> New service
            </Button>
          </div>
        </div>

        {/* Rooms & resources */}
        <div className="mb-5 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <button onClick={() => setShowResources((s) => !s)}
            className="flex w-full items-center justify-between px-4 py-3 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Rooms &amp; resources</span>
              {resources.length > 0 && (
                <span className="text-xs bg-gray-100 text-gray-500 font-medium px-2 py-0.5 rounded-full">{resources.length}</span>
              )}
            </div>
            <span className="text-xs text-violet-600 font-medium">{showResources ? "Hide" : "Manage"}</span>
          </button>
          {showResources && (
            <div className="border-t border-gray-50">
              <p className="text-xs text-gray-600 px-4 pt-3 pb-2">
                Shared rooms, chairs, or equipment. Assign one to a service and the slot is blocked whenever that resource is already in use.
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
                              {savingResource ? "…" : "Save"}
                            </button>
                            <button onClick={() => setEditingResource(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 shrink-0">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <span className={cn("text-sm font-medium", r.active ? "text-gray-900" : "text-gray-400 line-through")}>
                              {r.name}
                            </span>
                            {usedBy.length > 0 && (
                              <span className="ml-2 text-xs text-gray-500">
                                {usedBy.length} service{usedBy.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        {!isEditing && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => toggleResourceActive(r)}
                              title={r.active ? "Deactivate" : "Activate"}
                              className={cn(
                                "text-xs px-2 py-0.5 rounded-full border font-medium transition-colors",
                                r.active
                                  ? "text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                                  : "text-gray-500 border-gray-200 bg-gray-50 hover:bg-gray-100",
                              )}>
                              {r.active ? "Active" : "Inactive"}
                            </button>
                            <button
                              onClick={() => setEditingResource({ id: r.id, name: r.name })}
                              title="Rename"
                              className="p-1 text-gray-400 hover:text-gray-700 rounded">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeResource(r)}
                              title="Delete"
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
                <p className="px-4 pb-3 text-xs text-gray-600">No resources yet. Add one below.</p>
              )}

              {/* Add new resource */}
              <div className="flex gap-2 px-4 pb-4 pt-2 border-t border-gray-50">
                <Input
                  placeholder="e.g. Room 1, Chair 2, Laser"
                  value={resourceName}
                  onChange={(e) => setResourceName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addResource(); } }}
                />
                <Button size="sm" onClick={addResource} disabled={!resourceName.trim() || savingResource}>
                  {savingResource ? "Adding…" : "Add"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {loadError ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-3">{loadError}</p>
            <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">Retry</button>
          </div>
        ) : loading ? <SkeletonList rows={6} /> : services.length === 0 && categories.length === 0 ? (
          <EmptyState title="No services yet"
            description="Create categories to organise your services, then add services under each one." />
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
                        className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteCategory(cat)}
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
                          onDelete={() => deleteService(svc)} />
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
                  <span className="text-sm font-bold text-gray-500">Uncategorised</span>
                  <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5">{uncategorised.length}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {uncategorised.map(svc => (
                    <ServiceRow key={svc.id} svc={svc}
                      onEdit={() => { setEditSvc(svc); setSvcModal(true); }}
                      onToggle={() => toggleActive(svc)}
                      onDelete={() => deleteService(svc)} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty categories */}
            {categories.filter(c => !grouped.find(g => g.cat.id === c.id)).map(cat => (
              <div key={cat.id} className="bg-white rounded-2xl border border-dashed border-gray-200 px-4 py-3 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.color }} />
                <span className="text-sm font-semibold text-gray-500">{cat.name}</span>
                <span className="text-xs text-gray-400">— empty</span>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => { setEditCat(cat); setCatModal(true); }}
                    className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteCategory(cat)}
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
  const priceLabel = svc.priceType === "STARTING_AT"
    ? `Starting at ${formatPrice(svc.priceCents)}`
    : svc.priceType === "PER_HOUR"
      ? `${formatPrice(svc.priceCents)} / hr`
      : formatPrice(svc.priceCents);
  return (
    <div className={cn("flex items-center gap-4 px-4 py-3", !svc.active && "opacity-50")}>
      <div className="w-2.5 h-8 rounded-full shrink-0" style={{ background: svc.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-gray-900">{svc.name}</p>
          {!svc.active && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">archived</span>}
        </div>
        {svc.description && <p className="text-xs text-gray-500 truncate mt-0.5">{svc.description}</p>}
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDuration(svc.durationMinutes)}</span>
          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{priceLabel}</span>
          {(svc.bufferBeforeMin > 0 || svc.bufferAfterMin > 0) && (
            <span>+{svc.bufferBeforeMin}/{svc.bufferAfterMin}m buffer</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={onToggle} title={svc.active ? "Hide" : "Show"}
          className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
          {svc.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button onClick={onEdit}
          className="p-2 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          aria-label={`Delete ${svc.name}`}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
