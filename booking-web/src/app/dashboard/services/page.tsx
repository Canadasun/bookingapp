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
  priceCents: string; bufferBeforeMin: string; bufferAfterMin: string;
  capacity: string; resourceId: string;
  color: string; active: boolean; categoryId: string;
}
const EMPTY_SVC: ServiceFormState = {
  name: "", description: "", durationMinutes: "60", priceCents: "",
  bufferBeforeMin: "0", bufferAfterMin: "0", capacity: "1", resourceId: "", color: "#E9A23C", active: true, categoryId: "",
};

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
      bufferBeforeMin: String(editing.bufferBeforeMin),
      bufferAfterMin: String(editing.bufferAfterMin),
      capacity: String(editing.capacity ?? 1),
      resourceId: editing.resourceId ?? "",
      color: editing.color, active: editing.active,
      categoryId: editing.categoryId ?? "",
    } : EMPTY_SVC
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
      toast.success(editing ? "Service updated" : "Service created");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative w-full max-w-md z-10 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{editing ? "Edit service" : "New service"}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
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
                  value={Math.floor(Number(form.durationMinutes || 0) / 60)}
                  onChange={e => f("durationMinutes", String(Number(e.target.value) * 60 + (Number(form.durationMinutes || 0) % 60)))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {HOUR_OPTS.map(h => <option key={h} value={h}>{h} hour{h === 1 ? "" : "s"}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-400">Hours</p>
              </div>
              <div>
                <select
                  value={Number(form.durationMinutes || 0) % 60}
                  onChange={e => f("durationMinutes", String(Math.floor(Number(form.durationMinutes || 0) / 60) * 60 + Number(e.target.value)))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {MIN_OPTS.map(m => <option key={m} value={m}>{String(m).padStart(2, "0")} min</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-400">Minutes</p>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-violet-600 font-medium">Total: {fmtDurationLong(Number(form.durationMinutes || 0))}</p>
          </div>

          {[
            { k: "priceCents",      label: "Price *",             type: "number", ph: "45.00", step: "0.01" },
            { k: "bufferBeforeMin", label: "Buffer before (min)", type: "number", ph: "0" },
            { k: "bufferAfterMin",  label: "Buffer after (min)",  type: "number", ph: "0" },
          ].map(({ k, label, type, ph, step }) => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <Input type={type} placeholder={ph} value={form[k as keyof ServiceFormState] as string}
                onChange={e => f(k as keyof ServiceFormState, e.target.value)}
                min={0} step={step} />
            </div>
          ))}

          {/* Group / class capacity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group capacity</label>
            <Input type="number" min={1} step={1} value={form.capacity}
              onChange={e => f("capacity", e.target.value)} placeholder="1" />
            <p className="mt-1 text-xs text-gray-400">
              {Number(form.capacity) > 1
                ? `Up to ${Number(form.capacity)} clients can book the same time slot (group class).`
                : "1 = standard one-on-one booking. Increase for group classes."}
            </p>
          </div>

          {/* Room / resource this service occupies */}
          {resources.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Room / resource</label>
              <select value={form.resourceId} onChange={e => f("resourceId", e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">— None —</option>
                {resources.filter(r => r.active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-400">If set, the slot is blocked whenever this resource is already in use.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => f("color", c)}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative w-full max-w-sm z-10">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{editing ? "Edit category" : "New category"}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
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
  const [collapsed, setCollapsed]   = useState<Record<string, boolean>>({});

  const [svcModal, setSvcModal]   = useState(false);
  const [editSvc, setEditSvc]     = useState<Service | null>(null);
  const [catModal, setCatModal]   = useState(false);
  const [editCat, setEditCat]     = useState<ServiceCategory | null>(null);
  const [resourceName, setResourceName] = useState("");
  const [showResources, setShowResources] = useState(false);

  const user = getUser();
  const bizId = user?.businessId ?? "";

  const load = useCallback(async () => {
    if (!bizId) return;
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
    } catch { toast.error("Failed to load services"); }
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
    try { await api.resources.create(bizId, { name: n }); setResourceName(""); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to add"); }
  }
  async function removeResource(r: Resource) {
    if (!bizId) return;
    if (!confirm(`Delete "${r.name}"? Services using it will be unset.`)) return;
    try { await api.resources.remove(bizId, r.id); load(); }
    catch { toast.error("Failed to delete"); }
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
        <div className="mb-5 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <button onClick={() => setShowResources((s) => !s)}
            className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-sm font-semibold text-gray-900">Rooms &amp; resources {resources.length > 0 && <span className="text-gray-400 font-normal">({resources.length})</span>}</span>
            <span className="text-xs text-violet-600 font-medium">{showResources ? "Hide" : "Manage"}</span>
          </button>
          {showResources && (
            <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-2">
              <p className="text-xs text-gray-400">Shared rooms or equipment. Assign one to a service and that slot is blocked whenever the resource is in use.</p>
              <div className="flex flex-wrap gap-2">
                {resources.map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-sm text-gray-700">
                    {r.name}
                    <button onClick={() => removeResource(r)} className="text-gray-400 hover:text-red-600" aria-label={`Delete ${r.name}`}>×</button>
                  </span>
                ))}
                {resources.length === 0 && <span className="text-xs text-gray-400">No resources yet.</span>}
              </div>
              <div className="flex gap-2 pt-1">
                <Input placeholder="e.g. Room 1 · Chair 2 · Laser" value={resourceName}
                  onChange={(e) => setResourceName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addResource(); } }} />
                <Button size="sm" onClick={addResource} disabled={!resourceName.trim()}>Add</Button>
              </div>
            </div>
          )}
        </div>

        {loading ? <SkeletonList rows={6} /> : services.length === 0 && categories.length === 0 ? (
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
          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{formatPrice(svc.priceCents)}</span>
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
