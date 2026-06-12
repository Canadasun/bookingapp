"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Users, Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

type Dup = { id: string; name: string; email: string; phone?: string | null; createdAt: string; appointments: number };

export function ClientMergeModal({ bizId, onClose, onMerged }: { bizId: string; onClose: () => void; onMerged: () => void }) {
  const [groups, setGroups] = useState<{ clients: Dup[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  // Per-group choice of which record survives + the name to keep.
  const [choice, setChoice] = useState<Record<number, { primaryId: string; name: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const g = await api.clients.duplicates(bizId);
      setGroups(g);
      const init: Record<number, { primaryId: string; name: string }> = {};
      g.forEach((grp, i) => {
        // Default to the record with the most appointments, keep its name.
        const primary = [...grp.clients].sort((a, b) => b.appointments - a.appointments)[0];
        init[i] = { primaryId: primary.id, name: primary.name };
      });
      setChoice(init);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load duplicates"); }
    finally { setLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  async function merge(i: number) {
    const grp = groups[i];
    const c = choice[i];
    if (!grp || !c) return;
    setBusy(i);
    try {
      const res = await api.clients.merge(bizId, {
        primaryId: c.primaryId,
        dupeIds: grp.clients.filter((x) => x.id !== c.primaryId).map((x) => x.id),
        name: c.name.trim() || undefined,
      });
      toast.success(`Merged ${res.merged + 1} records into one`);
      onMerged();
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Merge failed"); }
    finally { setBusy(null); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-merge-modal-title"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-600" />
            <p id="client-merge-modal-title" className="text-sm font-semibold text-gray-900">Merge duplicate clients</p>
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? <LoadingSpinner /> : groups.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3"><Check className="w-6 h-6 text-emerald-600" /></div>
              <p className="font-semibold text-gray-900">No duplicates found</p>
              <p className="text-sm text-gray-500 mt-1">Clients with a shared phone or matching name will show up here to merge.</p>
            </div>
          ) : groups.map((grp, i) => (
            <div key={i} className="rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Likely the same person</p>
              <div className="space-y-2">
                {grp.clients.map((c) => (
                  <label key={c.id} className={cn("flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    choice[i]?.primaryId === c.id ? "border-violet-300 bg-violet-50" : "border-gray-100 hover:bg-gray-50")}>
                    <input
                      type="radio"
                      className="mt-1 accent-violet-600"
                      aria-label={`Select ${c.name} as primary client`}
                      checked={choice[i]?.primaryId === c.id}
                      onChange={() => setChoice((p) => ({ ...p, [i]: { primaryId: c.id, name: p[i]?.name ?? c.name } }))}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 truncate">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{c.appointments} booking{c.appointments === 1 ? "" : "s"}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Keep this name</label>
                <Input value={choice[i]?.name ?? ""} onChange={(e) => setChoice((p) => ({ ...p, [i]: { primaryId: p[i]?.primaryId ?? grp.clients[0].id, name: e.target.value } }))} />
              </div>
              <p className="text-[11px] text-gray-600 mt-2">All bookings, payments, messages and follow-ups move onto the selected record; the others are deleted.</p>
              <Button size="sm" className="mt-3 w-full" aria-label={`Merge ${grp.clients.length} duplicate client records into one`} loading={busy === i} onClick={() => merge(i)}>
                Merge {grp.clients.length} into one
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
