"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Plus, Check, Trash2, Circle, CalendarClock, User } from "lucide-react";
import { toast } from "sonner";
import { api, TaskItem, StaffMember } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

export default function TasksPage() {
  const user = getUser();
  const bizId = user?.businessId ?? "";
  const isOwner = user?.role === "OWNER" || user?.role === "ADMIN";

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", staffId: "", dueAt: "", notes: "" });

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoadError("");
    setLoading(true);
    try {
      const [t, s] = await Promise.all([
        api.tasks.list(bizId),
        isOwner ? api.staff.listAll(bizId).catch(() => []) : Promise.resolve([] as StaffMember[]),
      ]);
      setTasks(t);
      setStaff(s.filter((x) => x.active));
    } catch (e) { setLoadError(e instanceof Error ? e.message : "Failed to load tasks"); }
    finally { setLoading(false); }
  }, [bizId, isOwner]);
  useEffect(() => { load(); }, [load]);

  async function addTask() {
    if (!form.title.trim()) { toast.error("Add a task title"); return; }
    setSaving(true);
    try {
      await api.tasks.create(bizId, {
        title: form.title.trim(),
        staffId: form.staffId || null,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        notes: form.notes.trim() || undefined,
      });
      setForm({ title: "", staffId: "", dueAt: "", notes: "" });
      setShowAdd(false);
      toast.success("Task added");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not add task"); }
    finally { setSaving(false); }
  }

  async function toggle(t: TaskItem) {
    try {
      await api.tasks.update(bizId, t.id, { status: t.status === "DONE" ? "OPEN" : "DONE" });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update"); }
  }
  async function remove(t: TaskItem) {
    if (!confirm(`Delete "${t.title}"?`)) return;
    try { await api.tasks.remove(bizId, t.id); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete"); }
  }

  const open = tasks.filter((t) => t.status !== "DONE");
  const done = tasks.filter((t) => t.status === "DONE");

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tasks</h2>
          <p className="text-sm text-gray-500">
            {isOwner ? "Delegate work to your team — staff only see what you assign them." : "Your assigned tasks."}
          </p>
        </div>
        {isOwner && <Button size="sm" onClick={() => setShowAdd((v) => !v)} className="gap-1.5"><Plus className="w-4 h-4" />Add task</Button>}
      </div>

      {isOwner && showAdd && (
        <Card className="mb-5">
          <CardContent className="py-4 space-y-3">
            <Input placeholder="What needs doing? e.g. Restock shampoo, sanitize tools" value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            <div className="grid sm:grid-cols-2 gap-3">
              <select value={form.staffId} onChange={(e) => setForm((p) => ({ ...p, staffId: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Assign to… (optional)</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.user.name}</option>)}
              </select>
              <Input type="datetime-local" value={form.dueAt} onChange={(e) => setForm((p) => ({ ...p, dueAt: e.target.value }))} />
            </div>
            <Input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" loading={saving} onClick={addTask}>Add task</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loadError ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3">{loadError}</p>
          <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">Retry</button>
        </div>
      ) : loading ? <LoadingSpinner /> : tasks.length === 0 ? (
        <EmptyState title="No tasks yet" description={isOwner ? "Add a task and assign it to a team member." : "Nothing assigned to you right now."} />
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            {open.length === 0 ? <p className="text-sm text-gray-400">No open tasks 🎉</p> : open.map((t) => (
              <TaskRow key={t.id} t={t} isOwner={isOwner} onToggle={() => toggle(t)} onRemove={() => remove(t)} />
            ))}
          </div>
          {done.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Done ({done.length})</p>
              <div className="space-y-2 opacity-70">
                {done.map((t) => <TaskRow key={t.id} t={t} isOwner={isOwner} onToggle={() => toggle(t)} onRemove={() => remove(t)} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({ t, isOwner, onToggle, onRemove }: { t: TaskItem; isOwner: boolean; onToggle: () => void; onRemove: () => void }) {
  const dueDate = t.dueAt ? new Date(t.dueAt) : null;
  const overdue = dueDate && t.status !== "DONE" && dueDate < new Date();
  return (
    <Card>
      <CardContent className="py-3 flex items-center gap-3">
        <button onClick={onToggle} title={t.status === "DONE" ? "Reopen" : "Mark done"}
          className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
            t.status === "DONE" ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 text-transparent hover:border-violet-400")}>
          {t.status === "DONE" ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-0 h-0" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium text-gray-900", t.status === "DONE" && "line-through text-gray-400")}>{t.title}</p>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
            {t.staff?.user?.name && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{t.staff.user.name}</span>}
            {dueDate && <span className={cn("inline-flex items-center gap-1", overdue && "text-red-500 font-medium")}><CalendarClock className="w-3 h-3" />{format(dueDate, "MMM d, HH:mm")}</span>}
            {t.notes && <span className="italic truncate max-w-[16rem]">“{t.notes}”</span>}
          </div>
        </div>
        {isOwner && (
          <button onClick={onRemove} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors shrink-0" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
