"use client";

import { useEffect, useState, useCallback } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { CalendarClock, Clock, X, Repeat, Send } from "lucide-react";
import { toast } from "sonner";
import { api, ServiceDueItem } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

const CADENCES = [
  { days: 14, label: "2 weeks" },
  { days: 30, label: "Monthly" },
  { days: 42, label: "6 weeks" },
  { days: 56, label: "8 weeks" },
];
function cadenceLabel(days?: number | null) {
  if (!days) return "One-off";
  return CADENCES.find((c) => c.days === days)?.label ?? `Every ${days} days`;
}

export default function FollowupsPage() {
  const user = getUser();
  const bizId = user?.businessId ?? "";
  const [items, setItems] = useState<ServiceDueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [snoozing, setSnoozing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoading(true);
    try { setItems(await api.serviceDue.list(bizId)); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load follow-ups"); }
    finally { setLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  async function approve(it: ServiceDueItem) {
    setBusy(it.id);
    try {
      await api.serviceDue.approve(bizId, it.id);
      toast.success(`Invited ${it.client.name} to rebook${it.cadenceDays ? " — next due auto-scheduled" : ""}`);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  }
  async function snooze(it: ServiceDueItem, days: number) {
    setBusy(it.id);
    try { await api.serviceDue.reschedule(bizId, it.id, { cadenceDays: days }); setSnoozing(null); toast.success(`Rescheduled — due in ${cadenceLabel(days).toLowerCase()}`); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  }
  async function cancel(it: ServiceDueItem) {
    if (!confirm(`Stop follow-up reminders for ${it.client.name}?`)) return;
    setBusy(it.id);
    try { await api.serviceDue.cancel(bizId, it.id); toast.success("Follow-up cancelled"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  }

  const due = items.filter((i) => i.status === "DUE");
  const scheduled = items.filter((i) => i.status === "SCHEDULED");

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Follow-ups</h2>
        <p className="text-sm text-gray-500">Keep clients on a routine — set a client&apos;s next-visit cadence from their profile, and approve reminders here when they&apos;re due.</p>
      </div>

      {loading ? <LoadingSpinner /> : items.length === 0 ? (
        <EmptyState title="No follow-ups yet" description="Open a client and set 'Next visit due' (e.g. every 8 weeks) to start a routine." />
      ) : (
        <div className="space-y-6">
          {due.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Due now ({due.length})</p>
              <div className="space-y-2">
                {due.map((it) => (
                  <Card key={it.id} className="border-amber-200">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0"><CalendarClock className="w-4 h-4" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{it.client.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {it.service?.name ? `${it.service.name} · ` : ""}{cadenceLabel(it.cadenceDays)} · was due {formatDistanceToNow(new Date(it.dueAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      {snoozing === it.id ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-gray-500">Reschedule for:</span>
                          {CADENCES.map((c) => (
                            <button key={c.days} disabled={busy === it.id} onClick={() => snooze(it, c.days)}
                              className="text-xs font-semibold border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50">{c.label}</button>
                          ))}
                          <button onClick={() => setSnoozing(null)} className="text-xs text-gray-400 hover:text-gray-600">cancel</button>
                        </div>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" loading={busy === it.id} onClick={() => approve(it)} className="gap-1.5"><Send className="w-3.5 h-3.5" />Approve &amp; invite to rebook</Button>
                          <Button size="sm" variant="secondary" onClick={() => setSnoozing(it.id)} className="gap-1.5"><Repeat className="w-3.5 h-3.5" />Reschedule</Button>
                          <Button size="sm" variant="ghost" onClick={() => cancel(it)} className="gap-1.5 text-red-600"><X className="w-3.5 h-3.5" />Stop</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {scheduled.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Scheduled ({scheduled.length})</p>
              <div className="space-y-2">
                {scheduled.map((it) => (
                  <Card key={it.id}>
                    <CardContent className="py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 shrink-0"><Clock className="w-4 h-4" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{it.client.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{it.service?.name ? `${it.service.name} · ` : ""}{cadenceLabel(it.cadenceDays)} · next {format(new Date(it.dueAt), "MMM d, yyyy")}</p>
                      </div>
                      <button onClick={() => cancel(it)} className={cn("p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors shrink-0", busy === it.id && "opacity-50")} title="Stop"><X className="w-4 h-4" /></button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
