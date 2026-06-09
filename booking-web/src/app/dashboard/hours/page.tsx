"use client";

import { useEffect, useState, useCallback } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

interface HourRule { dayOfWeek: number; startTime: string; endTime: string; enabled: boolean }
interface Closure  { id: string; startsAt: string; endsAt: string; reason?: string }

export default function HoursPage() {
  const user  = getUser();
  const bizId = user?.businessId ?? "";

  const [rules, setRules] = useState<HourRule[]>(
    DAYS.map((_, i) => ({ dayOfWeek: i, startTime: "09:00", endTime: "17:00", enabled: i >= 1 && i <= 5 }))
  );
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [toForm,   setToForm]   = useState({ startsAt: "", endsAt: "", reason: "" });
  const [toSaving, setToSaving] = useState(false);

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await api.business.getHours(bizId);
      if (data.hours.length > 0) {
        setRules(DAYS.map((_, i) => {
          const h = data.hours.find((x: { dayOfWeek: number; startTime: string; endTime: string }) => x.dayOfWeek === i);
          return { dayOfWeek: i, startTime: h?.startTime ?? "09:00", endTime: h?.endTime ?? "17:00", enabled: !!h };
        }));
      }
      setClosures(data.closures);
    } catch { toast.error("Could not load hours"); }
    finally { setLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  function setRule(i: number, patch: Partial<HourRule>) {
    setRules((r) => r.map((x, j) => j === i ? { ...x, ...patch } : x));
  }

  function copyMonToWeekdays() {
    const mon = rules[1];
    if (!mon.enabled) { toast.error("Monday must be enabled to copy from it"); return; }
    setRules((r) => r.map((x, i) => i >= 1 && i <= 5 ? { ...x, startTime: mon.startTime, endTime: mon.endTime, enabled: true } : x));
    toast.success("Copied Monday hours to Tue–Fri");
  }

  async function save() {
    if (!bizId) return;
    setSaving(true);
    try {
      await api.business.setHours(bizId, rules.filter((r) => r.enabled).map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })));
      toast.success("Business hours saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
    finally { setSaving(false); }
  }

  async function addClosure() {
    if (!toForm.startsAt || !toForm.endsAt) { toast.error("Start and end are required"); return; }
    if (!bizId) return;
    setToSaving(true);
    try {
      const c = await api.business.addClosure(bizId, {
        startsAt: new Date(toForm.startsAt).toISOString(),
        endsAt:   new Date(toForm.endsAt).toISOString(),
        reason:   toForm.reason || undefined,
      });
      setClosures((prev) => [...prev, c]);
      setToForm({ startsAt: "", endsAt: "", reason: "" });
      toast.success("Closure saved — clients won't see slots during this period");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save closure"); }
    finally { setToSaving(false); }
  }

  async function removeClosure(id: string) {
    if (!bizId) return;
    try {
      await api.business.removeClosure(bizId, id);
      setClosures((prev) => prev.filter((c) => c.id !== id));
      toast.success("Closure removed");
    } catch { toast.error("Could not remove closure"); }
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
          <button type="button" onClick={copyMonToWeekdays}
            className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:underline">
            <Copy className="w-3.5 h-3.5" /> Copy Mon → Tue–Fri
          </button>
        </div>
        <div className="px-5 pb-5 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
          ) : rules.map((rule, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type="checkbox"
                id={`day-${i}`}
                checked={rule.enabled}
                onChange={(e) => setRule(i, { enabled: e.target.checked })}
                className="accent-violet-600 w-4 h-4 shrink-0 cursor-pointer"
              />
              <label htmlFor={`day-${i}`}
                className={cn("w-10 text-sm font-semibold shrink-0 cursor-pointer select-none",
                  rule.enabled ? "text-gray-800" : "text-gray-300")}>
                {SHORT[i]}
              </label>
              {rule.enabled ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Input type="time" value={rule.startTime} className="w-28 text-sm"
                    onChange={(e) => setRule(i, { startTime: e.target.value })} />
                  <span className="text-gray-400 text-sm">–</span>
                  <Input type="time" value={rule.endTime} className="w-28 text-sm"
                    onChange={(e) => setRule(i, { endTime: e.target.value })} />
                  <span className="text-xs text-gray-400">
                    {(() => {
                      const [sh, sm] = rule.startTime.split(":").map(Number);
                      const [eh, em] = rule.endTime.split(":").map(Number);
                      const mins = (eh * 60 + em) - (sh * 60 + sm);
                      if (mins <= 0) return "";
                      const h = Math.floor(mins / 60), m = mins % 60;
                      return `${h > 0 ? `${h}h ` : ""}${m > 0 ? `${m}m` : ""}`;
                    })()}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-gray-300">Closed</span>
              )}
            </div>
          ))}
          <div className="pt-2">
            <Button onClick={save} loading={saving} size="md">Save hours</Button>
          </div>
        </div>
      </div>

      {/* Closures / time off */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="px-5 pt-5 pb-1">
          <p className="text-sm font-semibold text-gray-900">Closures &amp; time off</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Block out dates when you&apos;re closed — holidays, vacations, or anything else.
            No booking slots will appear to clients during these periods.
          </p>
        </div>
        <div className="px-5 pb-5 space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <Input type="datetime-local" value={toForm.startsAt}
                onChange={(e) => setToForm((p) => ({ ...p, startsAt: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <Input type="datetime-local" value={toForm.endsAt}
                onChange={(e) => setToForm((p) => ({ ...p, endsAt: e.target.value }))} />
            </div>
          </div>
          <Input placeholder="Reason (optional — e.g. Holiday, Vacation)"
            value={toForm.reason}
            onChange={(e) => setToForm((p) => ({ ...p, reason: e.target.value }))} />
          <Button size="sm" variant="secondary" onClick={addClosure} loading={toSaving}
            className="flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add closure
          </Button>

          {closures.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Upcoming closures</p>
              {closures.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {new Date(c.startsAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                      {" — "}
                      {new Date(c.endsAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {c.reason && <p className="text-xs text-gray-500 mt-0.5">{c.reason}</p>}
                  </div>
                  <button type="button" onClick={() => removeClosure(c.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded shrink-0">
                    <Trash2 className="w-4 h-4" />
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
