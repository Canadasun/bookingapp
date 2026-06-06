"use client";

import { useEffect, useState, useCallback } from "react";
import { format, formatDistanceToNow, differenceInCalendarDays } from "date-fns";
import { CalendarClock, X, Repeat, Send, RefreshCw, Bell, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api, Service, ServiceDueItem } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Input } from "@/components/ui/input";
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
function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function FollowupsPage() {
  const user = getUser();
  const bizId = user?.businessId ?? "";
  const [items, setItems] = useState<ServiceDueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [snoozing, setSnoozing] = useState<string | null>(null);
  const [policies, setPolicies] = useState<Array<{ id:string; name:string; delayDays:number; subject:string; body:string; enabled:boolean; service?:{name:string}|null }>>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [policy, setPolicy] = useState({ name:"", serviceId:"", delayDays:14, subject:"Time for a follow-up", body:"We hope you are doing well. Book your follow-up appointment when you are ready." });

  const load = useCallback(async (silent = false) => {
    if (!bizId) { setLoading(false); return; }
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [dueItems, policyItems, serviceItems] = await Promise.all([api.serviceDue.list(bizId), api.serviceDue.policies(bizId), api.services.listAll(bizId)]);
      setItems(dueItems); setPolicies(policyItems); setServices(serviceItems);
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load follow-ups"); }
    finally { setLoading(false); setRefreshing(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  async function approve(it: ServiceDueItem) {
    setBusy(it.id);
    try {
      await api.serviceDue.approve(bizId, it.id);
      toast.success(`Invited ${it.client.name} to rebook${it.cadenceDays ? " — next due auto-scheduled" : ""}`);
      load(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  }
  async function snooze(it: ServiceDueItem, days: number) {
    setBusy(it.id);
    try { await api.serviceDue.reschedule(bizId, it.id, { cadenceDays: days }); setSnoozing(null); toast.success(`Rescheduled — due in ${cadenceLabel(days).toLowerCase()}`); load(true); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  }
  async function cancel(it: ServiceDueItem) {
    if (!confirm(`Stop follow-up reminders for ${it.client.name}?`)) return;
    setBusy(it.id);
    try { await api.serviceDue.cancel(bizId, it.id); toast.success("Follow-up cancelled"); load(true); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  }
  async function createPolicy() {
    if (!policy.name.trim() || !policy.subject.trim() || !policy.body.trim()) return toast.error("Complete the follow-up policy fields");
    try {
      await api.serviceDue.createPolicy(bizId, { ...policy, serviceId:policy.serviceId || null, name:policy.name.trim(), subject:policy.subject.trim(), body:policy.body.trim(), trigger:"COMPLETED" });
      setPolicy({ name:"", serviceId:"", delayDays:14, subject:"Time for a follow-up", body:"We hope you are doing well. Book your follow-up appointment when you are ready." });
      toast.success("Follow-up policy created"); load(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create policy"); }
  }

  const due = items.filter((i) => i.status === "DUE");
  const scheduled = items.filter((i) => i.status === "SCHEDULED");
  const next7 = scheduled.filter((i) => {
    const d = differenceInCalendarDays(new Date(i.dueAt), new Date());
    return d >= 0 && d <= 7;
  });

  const stats = [
    { label: "Due now",        value: due.length,       icon: Bell,          tone: "amber"  as const },
    { label: "Due this week",  value: next7.length,     icon: CalendarClock, tone: "violet" as const },
    { label: "Scheduled",      value: scheduled.length, icon: CheckCircle2,  tone: "emerald" as const },
  ];
  const toneCls: Record<string, string> = {
    amber:   "bg-amber-50 text-amber-700",
    violet:  "bg-violet-50 text-violet-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Follow-ups</h2>
          <p className="text-sm text-gray-500 mt-0.5 max-w-xl">Keep clients on a routine — set a client&apos;s next-visit cadence from their profile, and approve reminders here when they&apos;re due.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => load(true)} disabled={refreshing} className="gap-1.5 shrink-0">
          <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
        <div><p className="text-sm font-semibold text-gray-900">Professional follow-up policy</p><p className="text-xs text-gray-400">Automatically schedules a customized follow-up after a completed appointment.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={policy.name} onChange={(e)=>setPolicy(p=>({...p,name:e.target.value}))} placeholder="Policy name, e.g. Dental check-in" />
          <Input type="number" min={0} max={3660} value={policy.delayDays} onChange={(e)=>setPolicy(p=>({...p,delayDays:Number(e.target.value)}))} placeholder="Delay in days" />
        </div>
        <select value={policy.serviceId} onChange={(e)=>setPolicy(p=>({...p,serviceId:e.target.value}))} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
          <option value="">All services (business default)</option>
          {services.filter(service=>service.active).map(service=><option key={service.id} value={service.id}>{service.name}</option>)}
        </select>
        <Input value={policy.subject} onChange={(e)=>setPolicy(p=>({...p,subject:e.target.value}))} placeholder="Message subject" />
        <textarea className="min-h-20 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" maxLength={2000} value={policy.body} onChange={(e)=>setPolicy(p=>({...p,body:e.target.value}))} />
        <Button size="sm" onClick={createPolicy}>Add policy</Button>
        {policies.length > 0 && <div className="flex flex-wrap gap-2 pt-1">{policies.map(p=><span key={p.id} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">{p.name} · {p.delayDays} days</span>)}</div>}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-2.5">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", toneCls[s.tone])}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-gray-900 leading-none">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1 truncate">{s.label}</p>
                </div>
              </div>
            </div>
          );
        })}
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
                  <Card key={it.id} className="border-amber-200 ring-1 ring-amber-100/60">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs shrink-0">{initials(it.client.name)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{it.client.name}</p>
                            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">{cadenceLabel(it.cadenceDays)}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{it.client.email}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {it.service?.name ? `${it.service.name} · ` : ""}was due {formatDistanceToNow(new Date(it.dueAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      {snoozing === it.id ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                          <span className="text-xs text-gray-500">Reschedule for:</span>
                          {CADENCES.map((c) => (
                            <button key={c.days} disabled={busy === it.id} onClick={() => snooze(it, c.days)}
                              className="text-xs font-semibold border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 disabled:opacity-50">{c.label}</button>
                          ))}
                          <button onClick={() => setSnoozing(null)} className="text-xs text-gray-400 hover:text-gray-600">cancel</button>
                        </div>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
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
                {scheduled.map((it) => {
                  const days = differenceInCalendarDays(new Date(it.dueAt), new Date());
                  const soon = days >= 0 && days <= 7;
                  return (
                    <Card key={it.id}>
                      <CardContent className="py-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">{initials(it.client.name)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{it.client.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{it.service?.name ? `${it.service.name} · ` : ""}{cadenceLabel(it.cadenceDays)} · next {format(new Date(it.dueAt), "MMM d, yyyy")}</p>
                        </div>
                        <span className={cn("text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 shrink-0", soon ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-500")}>
                          {days <= 0 ? "due" : `${days}d`}
                        </span>
                        <button onClick={() => cancel(it)} className={cn("p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors shrink-0", busy === it.id && "opacity-50")} title="Stop"><X className="w-4 h-4" /></button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
