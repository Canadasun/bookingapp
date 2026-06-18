"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api, Resource } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function ResourcesPage() {
  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [resourceToDelete, setResourceToDelete] = useState<Resource | null>(null);

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoading(true);
    try { setResources(await api.resources.list(bizId)); }
    catch { toast.error("Could not load resources"); }
    finally { setLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const r = await api.resources.create(bizId, { name: newName.trim() });
      setResources((p) => [...p, r]);
      setNewName(""); setShowAdd(false);
      toast.success("Resource created");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setAdding(false); }
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    try {
      const r = await api.resources.update(bizId, id, { name: editName.trim() });
      setResources((p) => p.map((x) => x.id === id ? r : x));
      setEditingId(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  async function toggleActive(r: Resource) {
    try {
      const updated = await api.resources.update(bizId, r.id, { active: !r.active });
      setResources((p) => p.map((x) => x.id === r.id ? updated : x));
    } catch { toast.error("Failed to update"); }
  }

  async function remove() {
    if (!resourceToDelete) return;
    try {
      await api.resources.remove(bizId, resourceToDelete.id);
      setResources((p) => p.filter((x) => x.id !== resourceToDelete.id));
      toast.success("Deleted");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setResourceToDelete(null); }
  }

  if (!bizId) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resources</h1>
          <p className="text-sm text-gray-500 mt-1">Rooms, chairs, equipment — assign to services to limit double-booking.</p>
        </div>
        <Button onClick={() => setShowAdd((s) => !s)} className="gap-2">
          <Plus className="w-4 h-4" /> Add resource
        </Button>
      </div>

      {showAdd && (
        <form onSubmit={create} className="flex gap-2">
          <Input
            autoFocus
            aria-label="Resource name"
            placeholder="e.g. Room 1, Chair 3, Laser machine"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" loading={adding} disabled={!newName.trim()}>Add</Button>
          <Button type="button" variant="ghost" aria-label="Cancel" onClick={() => { setShowAdd(false); setNewName(""); }}>
            <X className="w-4 h-4" />
          </Button>
        </form>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : resources.length === 0 ? (
        <EmptyState
          title="No resources yet"
          description="Add rooms, chairs, or equipment to prevent double-bookings when multiple services share the same physical resource."
        />
      ) : (
        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white overflow-hidden">
          {resources.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              {editingId === r.id ? (
                <>
                  <Input
                    autoFocus
                    aria-label="Edit resource name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(r.id); if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 h-8 text-sm"
                  />
                  <button type="button" aria-label="Save name" onClick={() => saveEdit(r.id)} className="text-violet-600 hover:text-violet-800">
                    <Check className="w-4 h-4" />
                  </button>
                  <button type="button" aria-label="Cancel edit" onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className={`flex-1 text-sm font-medium ${r.active ? "text-gray-900" : "text-gray-400 line-through"}`}>
                    {r.name}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.active}
                    aria-label={`${r.name} active`}
                    onClick={() => toggleActive(r)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${r.active ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                  >
                    {r.active ? "Active" : "Inactive"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Edit ${r.name}`}
                    onClick={() => { setEditingId(r.id); setEditName(r.name); }}
                    className="text-gray-400 hover:text-gray-700 p-1"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" aria-label={`Delete ${r.name}`} onClick={() => setResourceToDelete(r)} className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={resourceToDelete !== null}
        title="Delete resource"
        description={`Delete "${resourceToDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={remove}
        onCancel={() => setResourceToDelete(null)}
      />
    </div>
  );
}
