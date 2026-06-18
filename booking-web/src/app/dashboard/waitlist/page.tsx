"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Trash2, Mail, Phone, CalendarPlus, Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Entry = {
  id: string; name: string; email: string; phone?: string | null; serviceId?: string | null;
  desiredDate?: string | null; notes?: string | null; status: "WAITING" | "NOTIFIED" | "CONVERTED" | "CANCELLED"; createdAt: string;
};

export default function WaitlistPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [entryToRemove, setEntryToRemove] = useState<Entry | null>(null);
  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoadError("");
    setLoading(true);
    try { setEntries(await api.waitlist.list(bizId)); }
    catch (e) { setLoadError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  async function remove() {
    if (!entryToRemove) return;
    try { await api.waitlist.remove(bizId, entryToRemove.id); toast.success("Removed"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setEntryToRemove(null); }
  }
  const waitingCount = entries.filter((entry) => entry.status === "WAITING").length;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Waitlist</h2>
          <p className="text-sm text-gray-500">Clients waiting for an opening — they&apos;re emailed automatically when a matching appointment is cancelled.</p>
        </div>
        {!loading && entries.length > 0 && (
          <span className="shrink-0 inline-flex items-center rounded-full bg-violet-100 text-violet-700 text-sm font-semibold px-3 py-1">
            {waitingCount} waiting
          </span>
        )}
      </div>
      {loadError ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3">{loadError}</p>
          <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">Retry</button>
        </div>
      ) : loading ? <LoadingSpinner /> : entries.length === 0 ? (
        <EmptyState title="No one on the waitlist yet" />
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <Card key={e.id}>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-semibold text-sm shrink-0">
                  {e.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{e.name}</p>
                  {e.status === "NOTIFIED" && (
                    <span className="mt-1 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                      Notified
                    </span>
                  )}
                  <p className="text-sm text-gray-500 truncate">{e.email}{e.phone ? ` · ${e.phone}` : ""}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Joined {format(new Date(e.createdAt), "MMM d")}
                    {e.desiredDate ? ` · prefers ${format(new Date(e.desiredDate), "MMM d")}` : ""}
                  </p>
                  {e.notes ? <p className="text-xs text-gray-500 mt-0.5 italic">&ldquo;{e.notes}&rdquo;</p> : null}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {e.phone && <a href={`tel:${e.phone}`} className="text-gray-400 hover:text-emerald-600 p-2" title="Call" aria-label="Call client"><Phone className="w-4 h-4" /></a>}
                  <a href={`mailto:${e.email}`} className="text-gray-400 hover:text-violet-600 p-2" title="Email" aria-label="Email client"><Mail className="w-4 h-4" /></a>
                  <a href={`mailto:${e.email}?subject=${encodeURIComponent("A booking spot is available")}&body=${encodeURIComponent(`Hi ${e.name}, a spot may be available. Reply to this email or book online if the time works for you.`)}`} className="text-gray-400 hover:text-blue-600 p-2" title="Notify" aria-label="Notify client"><Send className="w-4 h-4" /></a>
                  <Link href="/dashboard/appointments" className="text-gray-400 hover:text-violet-600 p-2" title="Book" aria-label="Book appointment"><CalendarPlus className="w-4 h-4" /></Link>
                  <button type="button" onClick={() => setEntryToRemove(e)} className="text-gray-400 hover:text-red-600 p-2" title="Remove" aria-label="Remove from waitlist"><Trash2 className="w-4 h-4" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={entryToRemove !== null}
        title="Remove from waitlist"
        description={`Remove ${entryToRemove?.name} from the waitlist?`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={remove}
        onCancel={() => setEntryToRemove(null)}
      />
    </div>
  );
}
