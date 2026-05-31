"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { ChevronLeft, Copy, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, StaffMember } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

interface Rule { dayOfWeek: number; startTime: string; endTime: string; enabled: boolean }
interface TimeOff { id: string; startsAt: string; endsAt: string; reason?: string }

export default function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [rules, setRules] = useState<Rule[]>(
    DAYS.map((_, i) => ({ dayOfWeek: i, startTime: "09:00", endTime: "17:00", enabled: i >= 1 && i <= 5 }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toForm, setToForm] = useState({ startsAt: "", endsAt: "", reason: "" });

  const user = getUser();
  const bizId = user?.businessId ?? "";

  const load = useCallback(async () => {
    if (!bizId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [s, tos] = await Promise.all([
        api.staff.get(bizId, id),
        api.staff.getTimeOffs(bizId, id),
      ]);
      setStaff(s);
      setTimeOffs(tos);
      if (s.availabilityRules?.length) {
        setRules(DAYS.map((_, i) => {
          const r = s.availabilityRules!.find((x) => x.dayOfWeek === i);
          return { dayOfWeek: i, startTime: r?.startTime ?? "09:00", endTime: r?.endTime ?? "17:00", enabled: !!r };
        }));
      }
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, [bizId, id]);

  useEffect(() => { load(); }, [load]);

  function setRule(i: number, patch: Partial<Rule>) {
    setRules((r) => r.map((x, j) => j === i ? { ...x, ...patch } : x));
  }

  function copyMondayToWeekdays() {
    const mon = rules[1];
    if (!mon.enabled) { toast.error("Monday is not enabled"); return; }
    setRules((r) => r.map((x, i) => i >= 1 && i <= 5 ? { ...x, startTime: mon.startTime, endTime: mon.endTime, enabled: true } : x));
    toast.success("Copied Monday to Mon–Fri");
  }

  async function saveAvailability() {
    if (!bizId) return;
    setSaving(true);
    try {
      await api.staff.setAvailability(bizId, id, rules.filter((r) => r.enabled).map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })));
      toast.success("Availability saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function addTimeOff() {
    if (!toForm.startsAt || !toForm.endsAt) { toast.error("Start and end date are required"); return; }
    if (!bizId) return;
    setSaving(true);
    try {
      await api.staff.addTimeOff(bizId, id, {
        startsAt: new Date(toForm.startsAt).toISOString(),
        endsAt: new Date(toForm.endsAt).toISOString(),
        reason: toForm.reason || undefined,
      });
      toast.success("Time off added");
      setToForm({ startsAt: "", endsAt: "", reason: "" });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function removeTimeOff(timeOffId: string) {
    if (!bizId) return;
    try {
      await api.staff.deleteTimeOff(bizId, id, timeOffId);
      toast.success("Removed");
      setTimeOffs((t) => t.filter((x) => x.id !== timeOffId));
    } catch { toast.error("Failed to remove"); }
  }

  if (loading) return <LoadingSpinner />;
  if (!staff) return <p className="text-gray-500">Staff not found.</p>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/staff" className="text-gray-400 hover:text-gray-600"><ChevronLeft className="w-5 h-5" /></Link>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{staff.user.name}</h2>
          <p className="text-sm text-gray-500">{staff.user.email}</p>
        </div>
      </div>

      {/* Availability */}
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Weekly availability</CardTitle>
            <button onClick={copyMondayToWeekdays}
              className="flex items-center gap-1.5 text-xs text-violet-600 hover:underline">
              <Copy className="w-3.5 h-3.5" /> Copy Mon→weekdays
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {rules.map((rule, i) => (
            <div key={i} className="flex items-center gap-3">
              <input type="checkbox" checked={rule.enabled} onChange={(e) => setRule(i, { enabled: e.target.checked })}
                className="accent-violet-600 w-4 h-4 shrink-0" />
              <span className={cn("w-8 text-sm font-medium shrink-0", rule.enabled ? "text-gray-700" : "text-gray-400")}>
                {SHORT[i]}
              </span>
              {rule.enabled ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input type="time" value={rule.startTime} className="w-28"
                    onChange={(e) => setRule(i, { startTime: e.target.value })} />
                  <span className="text-gray-400 text-sm">–</span>
                  <Input type="time" value={rule.endTime} className="w-28"
                    onChange={(e) => setRule(i, { endTime: e.target.value })} />
                </div>
              ) : <span className="text-sm text-gray-400">Off</span>}
            </div>
          ))}
          <Button onClick={saveAvailability} loading={saving} size="sm" className="mt-3">Save availability</Button>
        </CardContent>
      </Card>

      {/* Time off */}
      <Card>
        <CardHeader><CardTitle>Time off</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                <Input type="datetime-local" value={toForm.startsAt} onChange={(e) => setToForm((p) => ({ ...p, startsAt: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                <Input type="datetime-local" value={toForm.endsAt} onChange={(e) => setToForm((p) => ({ ...p, endsAt: e.target.value }))} />
              </div>
            </div>
            <Input placeholder="Reason (optional)" value={toForm.reason} onChange={(e) => setToForm((p) => ({ ...p, reason: e.target.value }))} />
            <Button size="sm" variant="secondary" onClick={addTimeOff} loading={saving} className="gap-1">
              <Plus className="w-4 h-4" /> Add time off
            </Button>
          </div>

          {timeOffs.length > 0 && (
            <div className="space-y-2 mt-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Scheduled time off</p>
              {timeOffs.map((to) => (
                <div key={to.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm text-gray-900">
                      {new Date(to.startsAt).toLocaleDateString()} – {new Date(to.endsAt).toLocaleDateString()}
                    </p>
                    {to.reason && <p className="text-xs text-gray-500">{to.reason}</p>}
                  </div>
                  <button onClick={() => removeTimeOff(to.id)} className="text-gray-400 hover:text-red-600 p-1 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
