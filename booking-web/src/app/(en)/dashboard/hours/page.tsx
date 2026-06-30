"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarOff, Check, Clock3, Copy, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import { useDashboardLocale } from "@/lib/dashboard-locale";
import { useLocationScope } from "@/lib/location-scope";

// Seven entries, Sunday-first; display labels come from the dictionary (hours.days).
const DAYS = [0, 1, 2, 3, 4, 5, 6];

interface HourRule { dayOfWeek: number; startTime: string; endTime: string; enabled: boolean }
interface Closure { id: string; startsAt: string; endsAt: string; reason?: string }

function defaultRules(): HourRule[] {
  return DAYS.map((_, dayOfWeek) => ({
    dayOfWeek,
    startTime: "09:00",
    endTime: "17:00",
    enabled: dayOfWeek >= 1 && dayOfWeek <= 5,
  }));
}

function minutes(time: string) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function durationLabel(rule: HourRule, invalidLabel: string) {
  const total = minutes(rule.endTime) - minutes(rule.startTime);
  if (total <= 0) return invalidLabel;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours ? `${hours}h` : ""}${hours && mins ? " " : ""}${mins ? `${mins}m` : ""}`;
}

export default function HoursPage() {
  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";
  const { dictionary, formatDate } = useDashboardLocale();
  const t = dictionary.hours;
  const formatClosureDate = (value: string) =>
    formatDate(value, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const [rules, setRules] = useState<HourRule[]>(defaultRules);
  const [savedRules, setSavedRules] = useState<HourRule[]>(defaultRules);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closureForm, setClosureForm] = useState({ startsAt: "", endsAt: "", reason: "" });
  const [closureSaving, setClosureSaving] = useState(false);
  const [loadedAt] = useState(() => Date.now());
  const { selectedIds: scopedLocationIds } = useLocationScope();
  const locationId = scopedLocationIds.length === 1 ? scopedLocationIds[0] : undefined;

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await api.business.getHours(bizId, locationId);
      const nextRules = defaultRules().map((fallback) => {
        const stored = data.hours.find((item: { dayOfWeek: number }) => item.dayOfWeek === fallback.dayOfWeek);
        return stored
          ? { ...fallback, startTime: stored.startTime, endTime: stored.endTime, enabled: true }
          : { ...fallback, enabled: false };
      });
      setRules(nextRules);
      setSavedRules(nextRules);
      setClosures(data.closures);
    } catch {
      toast.error(t.toasts.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [bizId, locationId, t.toasts.loadFailed]);

  useEffect(() => { void load(); }, [load]);

  const hasChanges = JSON.stringify(rules) !== JSON.stringify(savedRules);
  const openDays = rules.filter((rule) => rule.enabled).length;
  const invalidDays = useMemo(
    () => rules.filter((rule) => rule.enabled && minutes(rule.endTime) <= minutes(rule.startTime)),
    [rules],
  );
  const upcomingClosures = useMemo(
    () => [...closures]
      .filter((closure) => new Date(closure.endsAt).getTime() >= loadedAt)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [closures, loadedAt],
  );

  function setRule(index: number, patch: Partial<HourRule>) {
    setRules((current) => current.map((rule, itemIndex) => itemIndex === index ? { ...rule, ...patch } : rule));
  }

  function copyMonday() {
    const monday = rules[1];
    if (!monday.enabled) { toast.error(t.toasts.copyMondayFirst); return; }
    setRules((current) => current.map((rule, index) => index >= 1 && index <= 5
      ? { ...rule, startTime: monday.startTime, endTime: monday.endTime, enabled: true }
      : rule));
    toast.success(t.toasts.copiedMonday);
  }

  async function saveHours() {
    if (!bizId || invalidDays.length) {
      if (invalidDays.length) toast.error(t.toasts.invalidRange);
      return;
    }
    setSaving(true);
    try {
      await api.business.setHours(bizId, rules
        .filter((rule) => rule.enabled)
        .map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })), locationId);
      setSavedRules(rules);
      toast.success(t.toasts.hoursSaved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.toasts.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function addClosure() {
    if (!closureForm.startsAt || !closureForm.endsAt) { toast.error(t.toasts.chooseTimes); return; }
    const startsAt = new Date(closureForm.startsAt);
    const endsAt = new Date(closureForm.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      toast.error(t.toasts.closureEndAfterStart);
      return;
    }
    if (!bizId) return;
    setClosureSaving(true);
    try {
      const closure = await api.business.addClosure(bizId, {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason: closureForm.reason.trim() || undefined,
      }, locationId);
      setClosures((current) => [...current, closure]);
      setClosureForm({ startsAt: "", endsAt: "", reason: "" });
      toast.success(t.toasts.closureAdded);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.toasts.addClosureFailed);
    } finally {
      setClosureSaving(false);
    }
  }

  async function removeClosure(id: string) {
    if (!bizId) return;
    try {
      await api.business.removeClosure(bizId, id);
      setClosures((current) => current.filter((closure) => closure.id !== id));
      toast.success(t.toasts.closureRemoved);
    } catch {
      toast.error(t.toasts.removeClosureFailed);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">{t.eyebrow}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950">{t.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">{t.openDays.replace("{count}", String(openDays))}</span>
          <span className="rounded-full bg-gray-100 px-3 py-1.5 font-semibold">{t.upcomingClosures.replace("{count}", String(upcomingClosures.length))}</span>
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{t.weeklySchedule}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{t.timezoneNote}</p>
          </div>
          <button type="button" onClick={copyMonday} className="inline-flex items-center gap-1.5 self-start rounded-lg px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50">
            <Copy className="h-3.5 w-3.5" /> {t.copyMonday}
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {rules.map((rule, index) => {
            const invalid = rule.enabled && minutes(rule.endTime) <= minutes(rule.startTime);
            return (
              <div key={rule.dayOfWeek} className={cn("grid gap-3 px-5 py-4 transition-colors sm:grid-cols-[150px_1fr_auto] sm:items-center", rule.enabled ? "bg-white" : "bg-gray-50/70")}>
                <button type="button" role="switch" aria-checked={rule.enabled} onClick={() => setRule(index, { enabled: !rule.enabled })} className="flex items-center gap-3 text-left">
                  <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", rule.enabled ? "bg-violet-600" : "bg-gray-300")}>
                    <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform", rule.enabled && "translate-x-5")} />
                  </span>
                  <span>
                    <span className={cn("block text-sm font-semibold", rule.enabled ? "text-gray-900" : "text-gray-500")}>{t.days[index]}</span>
                    <span className="block text-[11px] text-gray-400">{rule.enabled ? t.open : t.closed}</span>
                  </span>
                </button>

                {rule.enabled ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`opens-${index}`}>{t.opensAria.replace("{day}", t.days[index])}</label>
                    <Input id={`opens-${index}`} type="time" value={rule.startTime} className={cn("w-32", invalid && "border-red-300")} onChange={(event) => setRule(index, { startTime: event.target.value })} />
                    <span className="text-xs font-medium text-gray-400">{t.to}</span>
                    <label className="sr-only" htmlFor={`closes-${index}`}>{t.closesAria.replace("{day}", t.days[index])}</label>
                    <Input id={`closes-${index}`} type="time" value={rule.endTime} className={cn("w-32", invalid && "border-red-300")} onChange={(event) => setRule(index, { endTime: event.target.value })} />
                  </div>
                ) : <p className="text-sm text-gray-400">{t.noSlots}</p>}

                <span className={cn("inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", invalid ? "bg-red-50 text-red-700" : rule.enabled ? "bg-violet-50 text-violet-700" : "text-gray-400")}>
                  {rule.enabled && <Clock3 className="h-3 w-3" />}{rule.enabled ? durationLabel(rule, t.invalidRange) : t.closed}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className={cn("text-xs", invalidDays.length ? "font-medium text-red-600" : hasChanges ? "text-amber-700" : "text-gray-500")}>
            {invalidDays.length ? t.footerInvalid : hasChanges ? t.footerUnsaved : t.footerSaved}
          </p>
          <div className="flex gap-2">
            {hasChanges && <Button variant="secondary" size="sm" onClick={() => setRules(savedRules)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />{t.reset}</Button>}
            <Button size="sm" onClick={saveHours} loading={saving} disabled={!hasChanges || invalidDays.length > 0}><Check className="mr-1.5 h-3.5 w-3.5" />{t.saveHours}</Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><CalendarOff className="h-5 w-5" /></span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{t.closuresTitle}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{t.closuresSubtitle}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
          <div>
            <label htmlFor="closure-from" className="mb-1.5 block text-xs font-semibold text-gray-600">{t.starts}</label>
            <Input id="closure-from" type="datetime-local" value={closureForm.startsAt} onChange={(event) => setClosureForm((current) => ({ ...current, startsAt: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="closure-to" className="mb-1.5 block text-xs font-semibold text-gray-600">{t.ends}</label>
            <Input id="closure-to" type="datetime-local" value={closureForm.endsAt} onChange={(event) => setClosureForm((current) => ({ ...current, endsAt: event.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="closure-reason" className="mb-1.5 block text-xs font-semibold text-gray-600">{t.reason} <span className="font-normal text-gray-400">{t.optional}</span></label>
            <Input id="closure-reason" maxLength={120} placeholder={t.reasonPlaceholder} value={closureForm.reason} onChange={(event) => setClosureForm((current) => ({ ...current, reason: event.target.value }))} />
          </div>
          <div className="sm:col-span-2"><Button size="sm" variant="secondary" onClick={addClosure} loading={closureSaving}><Plus className="mr-1.5 h-3.5 w-3.5" />{t.addClosure}</Button></div>
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.upcoming}</p>
          {upcomingClosures.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">{t.noUpcoming}</div>
          ) : upcomingClosures.map((closure) => (
            <div key={closure.id} className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800">{closure.reason || t.businessClosed}</p>
                <p className="mt-0.5 text-xs text-gray-500">{formatClosureDate(closure.startsAt)} <span className="text-gray-300">{t.to}</span> {formatClosureDate(closure.endsAt)}</p>
              </div>
              <button type="button" onClick={() => removeClosure(closure.id)} aria-label={t.removeClosureAria.replace("{reason}", closure.reason || t.closureFallback)} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
