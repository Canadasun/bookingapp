"use client";

import { useEffect, useState, useCallback } from "react";
import { ClipboardList } from "lucide-react";
import { api, type Business } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { IntakeFormEditor } from "@/components/IntakeFormEditor";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function FormsPage() {
  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";
  const [biz, setBiz] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoadError("");
    setLoading(true);
    try {
      setBiz(await api.business.get(bizId));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-violet-600" />
          <h1 className="text-xl font-bold text-gray-900">Forms</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Build the intake &amp; consultation questions clients answer when they book online.
        </p>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      ) : (
        <IntakeFormEditor bizId={bizId} initial={biz?.intakeQuestions ?? []} />
      )}
    </div>
  );
}
