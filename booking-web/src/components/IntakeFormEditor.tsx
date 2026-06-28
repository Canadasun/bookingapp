"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Trash2, Plus } from "lucide-react";
import { api, IntakeQuestion } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Intake / consultation form editor. Lives under Communication › Forms; clients
// answer these when they book online and the answers show on the appointment.
export function IntakeFormEditor({ bizId, initial }: { bizId: string; initial: IntakeQuestion[] }) {
  const [questions, setQuestions] = useState<IntakeQuestion[]>(initial);
  const [saving, setSaving] = useState(false);

  const add = () => setQuestions((q) => [...q, { id: Math.random().toString(36).slice(2, 9), label: "", required: false }]);
  const update = (id: string, patch: Partial<IntakeQuestion>) => setQuestions((q) => q.map((x) => x.id === id ? { ...x, ...patch } : x));
  const remove = (id: string) => setQuestions((q) => q.filter((x) => x.id !== id));

  async function save() {
    const cleaned = questions.map((q) => ({ ...q, label: q.label.trim() })).filter((q) => q.label);
    if (cleaned.some((q) => q.label.length > 200)) { toast.error("Questions must be under 200 characters"); return; }
    setSaving(true);
    try {
      await api.business.update(bizId, { intakeQuestions: cleaned });
      setQuestions(cleaned);
      toast.success(cleaned.length ? "Intake form saved" : "Intake form cleared");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="w-4 h-4 text-violet-600" />
        <p className="text-sm font-semibold text-gray-800">Intake / consultation form</p>
      </div>
      <p className="text-xs text-gray-400 mb-3">Questions clients answer when they book online. Answers show on the appointment.</p>

      <div className="space-y-2">
        {questions.map((q, qi) => (
          <div key={q.id} className="flex items-center gap-2">
            <Input value={q.label} placeholder="e.g. Any allergies or sensitivities?"
              aria-label={`Question ${qi + 1}`}
              onChange={(e) => update(q.id, { label: e.target.value })} className="flex-1" />
            <button type="button" onClick={() => update(q.id, { required: !q.required })}
              role="switch"
              aria-checked={q.required}
              aria-label={`Question ${qi + 1} required`}
              className={cn("text-xs font-semibold px-2.5 py-2 rounded-lg border transition-colors shrink-0",
                q.required ? "border-violet-200 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-400 hover:bg-gray-50")}>
              Required
            </button>
            <button type="button" onClick={() => remove(q.id)}
              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0" aria-label="Remove question">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {questions.length === 0 && <p className="text-xs text-gray-400">No questions yet — add one below.</p>}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add question</Button>
        <Button type="button" size="sm" loading={saving} onClick={save}>Save form</Button>
      </div>
    </div>
  );
}
