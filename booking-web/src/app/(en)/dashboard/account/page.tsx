"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Lock, Settings as SettingsIcon, ChevronRight, Mail, Power, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, Business } from "@/lib/api";
import { patchCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUpload } from "@/components/ImageUpload";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { formatPhoneInput, formatPhoneDisplay } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Me = {
  id: string; email: string; name: string; phone?: string | null;
  role: string; businessId: string | null; avatarUrl?: string | null;
};

export default function AccountPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [biz, setBiz] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [bizError, setBizError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", avatarUrl: null as string | null });
  const [dirty, setDirty] = useState(false);
  const [acctBusy, setAcctBusy] = useState(false);
  const [pauseConfirm, setPauseConfirm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [delConfirm, setDelConfirm] = useState("");

  function loadAccount() {
    setLoadError("");
    setBizError("");
    setLoading(true);
    api.users.me()
      .then((u) => {
        setMe(u);
        setForm({ name: u.name ?? "", phone: formatPhoneDisplay(u.phone), avatarUrl: u.avatarUrl ?? null });
        setDirty(false);
        if (u.role === "OWNER" && u.businessId) {
          api.business.get(u.businessId)
            .then((business) => { setBiz(business); setBizError(""); })
            .catch((e) => setBizError(e instanceof Error ? e.message : "Could not load business account controls"));
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load your account"))
      .finally(() => setLoading(false));
  }
  useEffect(() => { loadAccount(); }, []);

  async function toggleActive() {
    if (!biz) return;
    setPauseConfirm(false);
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
        phone: form.phone.trim() || null,
        avatarUrl: form.avatarUrl,
      });
      setMe(updated);
      setForm({ name: updated.name ?? "", phone: formatPhoneDisplay(updated.phone), avatarUrl: updated.avatarUrl ?? null });
      setDirty(false);
      // Refresh regenerates the readable profile cookie from authoritative API
      // data and preserves its server-side HMAC signature.
      const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
      if (refreshed.ok) {
        await api.users.me()
          .then((current) => patchCurrentUser({ name: current.name, email: current.email, businessId: current.businessId, avatarUrl: current.avatarUrl ?? undefined }))
          .catch(() => toast.error("Profile saved, but the sidebar may not update until you reload."));
      } else {
        toast.error("Profile saved, but the sidebar may not update until you reload.");
      }
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
      <ConfirmDialog
        open={pauseConfirm}
        title={biz?.suspended ? "Reactivate business?" : "Pause online booking?"}
        description={biz?.suspended
          ? "Your public booking page will be visible again and clients can book online."
          : "Your public booking page will be hidden and new online bookings will stop until you reactivate it."}
        confirmLabel={biz?.suspended ? "Reactivate" : "Pause business"}
        variant={biz?.suspended ? "default" : "destructive"}
        onConfirm={toggleActive}
        onCancel={() => setPauseConfirm(false)}
      />
      <div>
        <h2 className="text-xl font-bold text-gray-900">Your account</h2>
        <p className="text-sm text-gray-500 capitalize">{me.role.toLowerCase()}</p>
        {dirty && (
          <p className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
            Unsaved profile changes
          </p>
        )}
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
              alt={`${form.name || "Your"} profile photo`}
              onChange={(url) => { setDirty(true); setForm((p) => ({ ...p, avatarUrl: url })); }}
            />
            <p className="mt-2 text-xs text-gray-400">Click Save changes after uploading or removing a photo.</p>
          </div>

          <div>
            <label htmlFor="account-name" className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <Input id="account-name" value={form.name} onChange={(e) => { setDirty(true); setForm((p) => ({ ...p, name: e.target.value })); }} placeholder="Your name" />
          </div>

          <div>
            <label htmlFor="account-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <Input id="account-phone" type="tel" value={form.phone} onChange={(e) => { setDirty(true); setForm((p) => ({ ...p, phone: formatPhoneInput(e.target.value) })); }} placeholder="+1 (416) 555-0123" />
          </div>

          <div>
            <p id="account-email-label" className="block text-sm font-medium text-gray-700 mb-1">Email</p>
            <div role="textbox" aria-labelledby="account-email-label" aria-readonly="true" className="flex items-center gap-2 px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-500">
              <Mail className="w-4 h-4 shrink-0" /> {me.email}
            </div>
            <p className="text-xs text-gray-400 mt-1">Your sign-in email can&apos;t be changed here.</p>
          </div>

          <div className="flex justify-end">
            <Button loading={saving} disabled={!dirty} onClick={save}>Save changes</Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="space-y-2">
        {isOwner && (
          <Link href="/dashboard/settings?tab=profile"
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
        <Link href="/dashboard/settings?tab=security"
          className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 hover:bg-gray-50 transition-colors">
          <span className="inline-flex w-9 h-9 rounded-lg bg-violet-50 items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-violet-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Security &amp; two-factor</p>
            <p className="text-xs text-gray-500">Protect your sign-in with an extra verification step.</p>
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

      {isOwner && bizError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold text-red-800">Could not load business controls.</p>
          <p className="mt-1 text-xs">{bizError}</p>
          <button type="button" onClick={loadAccount} className="mt-2 text-xs font-semibold underline underline-offset-2">Retry</button>
        </div>
      )}

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
                <Button type="button" onClick={() => setPauseConfirm(true)} loading={acctBusy}
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
                <label htmlFor="delete-confirm" className="block text-xs font-medium text-red-800">
                  Type <span className="font-mono">{biz.name}</span> to confirm
                </label>
                <Input id="delete-confirm" value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)}
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
