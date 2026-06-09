"use client";

import { useEffect, useState, useCallback } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

interface Rule { dayOfWeek: number; startTime: string; endTime: string; enabled: boolean }
interface TimeOff { id: string; startsAt: string; endsAt: string; reason?: string }

export default function HoursPage() {
  const user  = getUser();
  const bizId = user?.businessId ?? "";
  // Owner is always represented by their own staffId in the scheduling engine.
  const staffId = user?.staffId ?? "";

  const [rules, setRules] = useState<Rule[]>(
    DAYS.map((_, i) => ({ dayOfWeek: i, startTime: "09:00", endTime: "17:00", enabled: i >= 1 && i <= 5 }))
  );
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toForm, setToForm] = useState({ startsAt: "", endsAt: "", reason: "" });
  const [toSaving, setToSaving] = useState(false);

  const load = useCallback(async () => {
    if (!bizId || !staffId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [s, tos] = await Promise.all([
        api.staff.get(bizId, staffId),
        api.staff.getTimeOffs(bizId, staffId),
      ]);
      if (s.availabilityRules?.length) {
        setRules(DAYS.map((_, i) => {
          const r = s.availabilityRules!.find((x) => x.dayOfWeek === i);
          return { dayOfWeek: i, startTime: r?.startTime ?? "09:00", endTime: r?.endTime ?? "17:00", enabled: !!r };
        }));
      }
      setTimeOffs(tos);
    } catch { toast.error("Could not load hours"); }
    finally { setLoading(false); }
  }, [bizId, staffId]);

  useEffect(() => { load(); }, [load]);

  function setRule(i: number, patch: Partial<Rule>) {
    setRules((r) => r.map((x, j) => j === i ? { ...x, ...patch } : x));
  }

  function copyMonToWeekdays() {
    const mon = rules[1];
    if (!mon.enabled) { toast.error("Monday must be enabled to copy from it"); return; }
    setRules((r) => r.map((x, i) => i >= 1 && i <= 5 ? { ...x, startTime: mon.startTime, endTime: mon.endTime, enabled: true } : x));
    toast.success("Copied Monday hours to Tue–Fri");
  }

  async function save() {
    if (!bizId || !staffId) return;
    setSaving(true);
    try {
      await api.staff.setAvailability(
        bizId, staffId,
        rules.filter((r) => r.enabled).map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }))
      );
      toast.success("Business hours saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
    finally { setSaving(false); }
  }

  async function addTimeOff() {
    if (!toForm.startsAt || !toForm.endsAt) { toast.error("Start and end are required"); return; }
    if (!bizId || !staffId) return;
    setToSaving(true);
    try {
      await api.staff.addTimeOff(bizId, staffId, {
        startsAt: new Date(toForm.startsAt).toISOString(),
        endsAt: new Date(toForm.endsAt).toISOString(),
        reason: toForm.reason || undefined,
      });
      toast.success("Time off added — that period will show as unavailable to clients");
      setToForm({ startsAt: "", endsAt: "", reason: "" });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not add time off"); }
    finally { setToSaving(false); }
  }

  async function removeTimeOff(id: string) {
    if (!bizId || !staffId) return;
    try {
      await api.staff.deleteTimeOff(bizId, staffId, id);
      setTimeOffs((t) => t.filter((x) => x.id !== id));
      toast.success("Removed");
    } catch { toast.error("Could not remove"); }
  }

  if (!staffId) {
    return (
      <div className="max-w-xl mx-auto pt-10 text-center">
        <p className="text-gray-500 text-sm">Your account doesn&apos;t have a schedule profile yet. Sign out and back in, or contact support.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Business hours</h2>
        <p className="text-sm text-gray-400 mt-0.5">The days and times you&apos;re open. Clients can only book within these windows.</p>
      </div>

      {/* Weekly schedule */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p className="text-sm font-semibold text-gray-900">Weekly schedule</p>
          <button
            type="button"
            onClick={copyMonToWeekdays}
            className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:underline"
          >
            <Copy className="w-3.5 h-3.5" /> Copy Mon → Tue–Fri
          </button>
        </div>
        <div className="px-5 pb-5 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
          ) : rules.map((rule, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) => setRule(i, { enabled: e.target.checked })}
                className="accent-violet-600 w-4 h-4 shrink-0 cursor-pointer"
              />
              <span className={cn("w-9 text-sm font-semibold shrink-0", rule.enabled ? "text-gray-800" : "text-gray-300")}>
                {SHORT[i]}
              </span>
              {rule.enabled ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={rule.startTime}
                    onChange={(e) => setRule(i, { startTime: e.target.value })}
                    className="w-28 text-sm"
                  />
                  <span className="text-gray-400 text-sm">–</span>
                  <Input
                    type="time"
                    value={rule.endTime}
                    onChange={(e) => setRule(i, { endTime: e.target.value })}
                    className="w-28 text-sm"
                  />
                </div>
              ) : (
                <span className="text-sm text-gray-300">Closed</span>
              )}
            </div>
          ))}
          <Button onClick={save} loading={saving} size="md" className="mt-2">
            Save hours
          </Button>
        </div>
      </div>

      {/* Closures / time off */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="px-5 pt-5 pb-3">
          <p className="text-sm font-semibold text-gray-900">Closures &amp; time off</p>
          <p className="text-xs text-gray-400 mt-0.5">Block out dates when you&apos;re closed — holidays, vacations, or anything else. Clients won&apos;t see booking slots during these periods.</p>
        </div>
        <div className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <Input type="datetime-local" value={toForm.startsAt} onChange={(e) => setToForm((p) => ({ ...p, startsAt: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <Input type="datetime-local" value={toForm.endsAt} onChange={(e) => setToForm((p) => ({ ...p, endsAt: e.target.value }))} />
            </div>
          </div>
          <Input
            placeholder="Reason (optional — e.g. Holiday, Vacation)"
            value={toForm.reason}
            onChange={(e) => setToForm((p) => ({ ...p, reason: e.target.value }))}
          />
          <Button size="sm" variant="secondary" onClick={addTimeOff} loading={toSaving}>
            + Add closure
          </Button>

          {timeOffs.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Upcoming closures</p>
              {timeOffs.map((to) => (
                <div key={to.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {new Date(to.startsAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                      {" — "}
                      {new Date(to.endsAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {to.reason && <p className="text-xs text-gray-500 mt-0.5">{to.reason}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTimeOff(to.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
