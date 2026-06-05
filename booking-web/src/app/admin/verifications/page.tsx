"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ShieldCheck, RefreshCw, FileText, ExternalLink, Check, X, LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { getUser, clearSession } from "@/lib/auth";
import { VerifiedBadge } from "@/components/VerifiedBadge";

type Pending = {
  id: string; name: string; email: string; slug: string;
  verificationDocUrl: string | null; verificationSubmittedAt: string | null;
};

const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

export default function AdminVerificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const me = getUser();

  const load = useCallback((showSpinner = true) => {
    if (showSpinner) setLoading(true);
    api.adminVerifications.list()
      .then(setItems)
      .catch(() => toast.error("Could not load verifications"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function approve(b: Pending) {
    if (!window.confirm(`Verify "${b.name}"? They'll get a Verified badge across their booking page, dashboard and emails.`)) return;
    setBusy(b.id);
    try { await api.adminVerifications.approve(b.id); toast.success(`${b.name} is now verified`); load(false); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  }
  async function reject(b: Pending) {
    const note = window.prompt(`Reject "${b.name}"? Optional reason the owner will see:`);
    if (note === null) return; // cancelled
    setBusy(b.id);
    try { await api.adminVerifications.reject(b.id, note || undefined); toast.success("Rejected"); load(false); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin top bar */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 leading-tight">Pulse Admin</p>
              <p className="text-xs text-gray-400 leading-tight">Verification review</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {me && <span className="hidden sm:inline text-sm text-gray-500">{me.email}</span>}
            <button onClick={signOut}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Business verifications</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? "Loading…" : items.length === 0 ? "Nothing waiting" : `${items.length} business${items.length === 1 ? "" : "es"} awaiting review`}
            </p>
          </div>
          <button onClick={() => load()} disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-white border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="font-semibold text-gray-900">All caught up</p>
            <p className="text-sm text-gray-500 mt-1">No businesses are waiting for verification right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((b) => {
              const submitted = b.verificationSubmittedAt ? new Date(b.verificationSubmittedAt) : null;
              return (
                <div key={b.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0">
                      {initials(b.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 truncate">{b.name}</p>
                        <span className="text-[11px] text-gray-400">will receive</span>
                        <VerifiedBadge />
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{b.email} · /{b.slug}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {submitted && (
                          <span className="text-xs text-gray-400" title={format(submitted, "PPpp")}>
                            Submitted {formatDistanceToNow(submitted, { addSuffix: true })}
                          </span>
                        )}
                        {b.verificationDocUrl ? (
                          <a href={b.verificationDocUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline">
                            <FileText className="w-3.5 h-3.5" /> View document <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                            <FileText className="w-3.5 h-3.5" /> No document attached
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-gray-50">
                    <button disabled={busy === b.id} onClick={() => reject(b)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-60 rounded-xl px-4 py-2 transition-colors">
                      <X className="w-4 h-4" /> Reject
                    </button>
                    <button disabled={busy === b.id} onClick={() => approve(b)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-xl px-4 py-2 transition-colors">
                      <Check className="w-4 h-4" /> {busy === b.id ? "Saving…" : "Approve"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
