"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

type Pending = {
  id: string; name: string; email: string; slug: string;
  verificationDocUrl: string | null; verificationSubmittedAt: string | null;
};

export default function AdminVerificationsPage() {
  const [items, setItems] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.adminVerifications.list()
      .then(setItems)
      .catch(() => toast.error("Could not load verifications"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function approve(id: string) {
    setBusy(id);
    try { await api.adminVerifications.approve(id); toast.success("Business verified"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  }
  async function reject(id: string) {
    const note = window.prompt("Reason for rejection (optional):") ?? undefined;
    setBusy(id);
    try { await api.adminVerifications.reject(id, note || undefined); toast.success("Rejected"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Business verifications</h1>
        <p className="text-sm text-gray-500 mb-6">Review documents and approve businesses awaiting verification.</p>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-400">No pending verifications. 🎉</p>
        ) : (
          <div className="space-y-3">
            {items.map((b) => (
              <div key={b.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{b.name}</p>
                  <p className="text-xs text-gray-500 truncate">{b.email} · /{b.slug}</p>
                  {b.verificationDocUrl && (
                    <a href={b.verificationDocUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-medium text-violet-600 hover:underline mt-1 inline-block">View document →</a>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button disabled={busy === b.id} onClick={() => approve(b.id)}
                    className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg px-3 py-1.5">Approve</button>
                  <button disabled={busy === b.id} onClick={() => reject(b.id)}
                    className="text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-60 rounded-lg px-3 py-1.5">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
