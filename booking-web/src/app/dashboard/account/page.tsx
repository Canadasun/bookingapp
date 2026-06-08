"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Lock, Settings as SettingsIcon, ChevronRight, Mail, Power, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, Business } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUpload } from "@/components/ImageUpload";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { formatPhoneInput } from "@/lib/utils";

type Me = {
  id: string; email: string; name: string; phone?: string | null;
  role: string; businessId: string | null; avatarUrl?: string | null;
};

// Keep the readable session cookie in sync after a profile change so the sidebar
// / top bar show the new name immediately (it's a non-HttpOnly display cookie).
function syncSessionName(name: string) {
  try {
    const u = getUser();
    if (!u) return;
    const next = { ...u, name };
    document.cookie = `booking_user=${btoa(JSON.stringify(next))}; path=/; max-age=${60 * 60 * 24 * 7}`;
  } catch { /* best-effort */ }
}

export default function AccountPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [biz, setBiz] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", avatarUrl: null as string | null });
  const [acctBusy, setAcctBusy] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [delConfirm, setDelConfirm] = useState("");

  function loadAccount() {
    setLoadError("");
    setLoading(true);
    api.users.me()
      .then((u) => {
        setMe(u);
        setForm({ name: u.name ?? "", phone: u.phone ?? "", avatarUrl: u.avatarUrl ?? null });
        if (u.role === "OWNER" && u.businessId) {
          api.business.get(u.businessId).then(setBiz).catch(() => {});
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load your account"))
      .finally(() => setLoading(false));
  }
  useEffect(() => { loadAccount(); }, []);

  async function toggleActive() {
    if (!biz) return;
    setAcctBusy(true);
    try {
      const updated = biz.suspended ? await api.business.reactivate(biz.id) : await api.business.deactivate(biz.id);
      setBiz(updated);
      toast.success(updated.suspended ? "Your business is now paused — your booking page is hidden." : "Welcome back — your business is live again.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update your business"); }
    finally { setAcctBusy(false); }
  }

  async function deleteAccount() {
    if (!biz) return;
    setAcctBusy(true);
    try {
      await api.business.remove(biz.id, delConfirm);
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      toast.success("Your account and all its data have been permanently deleted.");
      window.location.assign("/");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete your account"); setAcctBusy(false); }
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Your name can't be empty"); return; }
    setSaving(true);
    try {
      const updated = await api.users.updateMe({
        name: form.name.trim(),
        phone: form.phone.trim(),
        avatarUrl: form.avatarUrl,
      });
      setMe(updated);
      syncSessionName(updated.name);
      toast.success("Profile saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (loadError) return (
    <div className="text-center py-20">
      <p className="text-red-500 mb-3">{loadError}</p>
      <button onClick={loadAccount} className="text-violet-600 hover:underline text-sm">Try again</button>
    </div>
  );
  if (!me) return null;

  const isOwner = me.role === "OWNER";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Your account</h2>
        <p className="text-sm text-gray-500 capitalize">{me.role.toLowerCase()}</p>
      </div>

      {/* Profile */}
      <Card>
        <CardContent className="space-y-5 py-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profile photo</label>
            <ImageUpload
              value={form.avatarUrl}
              kind="AVATAR"
              shape="circle"
              onChange={(url) => setForm((p) => ({ ...p, avatarUrl: url }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Your name" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <Input type="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))} placeholder="+1 (416) 555-0123" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-500">
              <Mail className="w-4 h-4 shrink-0" /> {me.email}
            </div>
            <p className="text-xs text-gray-400 mt-1">Your sign-in email can&apos;t be changed here.</p>
          </div>

          <div className="flex justify-end">
            <Button loading={saving} onClick={save}>Save changes</Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="space-y-2">
        {isOwner && (
          <Link href="/dashboard/settings"
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 hover:bg-gray-50 transition-colors">
            <span className="inline-flex w-9 h-9 rounded-lg bg-violet-50 items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-violet-600" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">Business profile</p>
              <p className="text-xs text-gray-500">Set your store name, logo, contact info and timezone.</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          </Link>
        )}
        <Link href="/change-password"
          className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 hover:bg-gray-50 transition-colors">
          <span className="inline-flex w-9 h-9 rounded-lg bg-violet-50 items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-violet-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Password</p>
            <p className="text-xs text-gray-500">Change the password you use to sign in.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
        </Link>
        {isOwner && (
          <Link href="/dashboard/settings"
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 hover:bg-gray-50 transition-colors">
            <span className="inline-flex w-9 h-9 rounded-lg bg-violet-50 items-center justify-center shrink-0">
              <SettingsIcon className="w-4 h-4 text-violet-600" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">All settings</p>
              <p className="text-xs text-gray-500">Booking policies, payments, security &amp; two-factor, billing.</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          </Link>
        )}
      </div>

      {/* Owner: pause (reversible) or permanently delete the business. */}
      {isOwner && biz && (
        <div className="space-y-3 pt-2">
          <Card>
            <CardContent className="py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {biz.suspended ? "Your business is paused" : "Pause your business"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 max-w-md">
                    {biz.suspended
                      ? "Your public booking page is hidden and no new online bookings can come in. Your data is safe — reactivate any time."
                      : "Temporarily hide your public booking page and stop new online bookings. Nothing is deleted — turn it back on whenever you’re ready."}
                  </p>
                </div>
                <Button type="button" onClick={toggleActive} loading={acctBusy}
                  variant={biz.suspended ? "primary" : "outline"} className="shrink-0 gap-1.5">
                  <Power className="w-4 h-4" />
                  {biz.suspended ? "Reactivate" : "Pause"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Delete — de-emphasized, behind a type-the-name confirm. */}
          {!showDelete ? (
            <button type="button" onClick={() => setShowDelete(true)}
              className="text-xs text-gray-400 hover:text-red-600 underline underline-offset-2">
              Delete your business permanently
            </button>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-5 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Delete this business permanently</p>
                  <p className="text-xs text-red-700/80 mt-1 max-w-md">
                    This erases your business and <strong>everything in it</strong> — clients, bookings, staff, services, payments and your login. This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-red-800">
                  Type <span className="font-mono">{biz.name}</span> to confirm
                </label>
                <Input value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)}
                  placeholder={biz.name} className="max-w-sm border-red-300 focus-visible:ring-red-400" />
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" onClick={deleteAccount}
                  loading={acctBusy}
                  disabled={delConfirm.trim().toLowerCase() !== biz.name.trim().toLowerCase()}
                  className="gap-1.5 bg-red-600 hover:bg-red-700 text-white">
                  <Trash2 className="w-4 h-4" />
                  Permanently delete
                </Button>
                <button type="button" onClick={() => { setShowDelete(false); setDelConfirm(""); }}
                  className="text-xs text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
