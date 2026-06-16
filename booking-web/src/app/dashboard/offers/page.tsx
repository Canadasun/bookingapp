"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Offer { id: string; title: string; description: string; discount?: string; expiresAt?: string; active: boolean }
const EMPTY = { title: "", description: "", discount: "", expiresAt: "" };

export default function OffersPage() {
  const [offers, setOffers]   = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<Offer | null>(null);

  const user = getUser();
  const bizId = user?.businessId ?? "";

  const load = useCallback(async () => {
    if (!bizId) {
      setLoading(false);
      return;
    }
    setLoadError("");
    setLoading(true);
    try { setOffers(await api.offers.list(bizId)); }
    catch (e) { setLoadError(e instanceof Error ? e.message : "Failed to load offers"); }
    finally { setLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(o: Offer) {
    setEditing(o);
    setForm({ title: o.title, description: o.description, discount: o.discount ?? "", expiresAt: o.expiresAt ? o.expiresAt.slice(0, 16) : "" });
    setShowModal(true);
  }

  async function save() {
    if (!form.title || !form.description) { toast.error("Title and description required"); return; }
    if (!bizId) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = { title: form.title, description: form.description, discount: form.discount || undefined, active: true };
      if (form.expiresAt) data.expiresAt = new Date(form.expiresAt).toISOString();
      if (editing) await api.offers.update(bizId, editing.id, data);
      else await api.offers.create(bizId, data);
      toast.success(editing ? "Offer updated" : "Offer created");
      setShowModal(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function doRemove() {
    if (!bizId || !offerToDelete) return;
    try { await api.offers.remove(bizId, offerToDelete.id); toast.success("Removed"); setOfferToDelete(null); load(); }
    catch { toast.error("Failed"); setOfferToDelete(null); }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <ConfirmDialog
        open={offerToDelete !== null}
        title={`Remove "${offerToDelete?.title}"?`}
        description="This offer will be removed from the client portal."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={doRemove}
        onCancel={() => setOfferToDelete(null)}
      />
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Offers &amp; Promotions</h2>
          <p className="text-sm text-gray-600 mt-0.5">Visible to clients in their portal</p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" />New offer</Button>
      </div>

      {loadError ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3">{loadError}</p>
          <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">Retry</button>
        </div>
      ) : loading ? <LoadingSpinner /> : offers.length === 0 ? (
        <EmptyState title="No offers yet" description="Create your first promotion — clients will see it in their portal." />
      ) : (
        <div className="space-y-3">
          {offers.map((o) => (
            <Card key={o.id}>
              <CardContent className="py-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <Tag className="w-5 h-5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{o.title}</p>
                    {o.discount && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        {o.discount}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{o.description}</p>
                  {o.expiresAt && (
                    <p className="text-xs text-amber-600 mt-1">Expires {format(new Date(o.expiresAt), "MMM d, yyyy")}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(o)} aria-label="Edit" className="p-2 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setOfferToDelete(o)} aria-label="Delete" className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <div
          className="dashboard-safe-bottom fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="offer-modal-title"
          tabIndex={-1}
          onKeyDown={(e) => e.key === "Escape" && setShowModal(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={() => setShowModal(false)} />
          <Card className="relative w-full max-w-md z-10">
            <CardHeader><CardTitle id="offer-modal-title">{editing ? "Edit offer" : "New offer"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { k: "title",       label: "Title *",              type: "text",     ph: "e.g. Halloween Special" },
                { k: "description", label: "Description *",        type: "text",     ph: "What's included?" },
                { k: "discount",    label: "Discount label",       type: "text",     ph: "e.g. 20% off, $10 off" },
                { k: "expiresAt",   label: "Expires (optional)",   type: "datetime-local", ph: "" },
              ].map(({ k, label, type, ph }, index) => (
                <div key={k}>
                  <label htmlFor={`offer-${k}`} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <Input id={`offer-${k}`} type={type} placeholder={ph} value={form[k as keyof typeof form]}
                    autoFocus={index === 0}
                    onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button className="flex-1" loading={saving} onClick={save}>{editing ? "Save" : "Create"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
