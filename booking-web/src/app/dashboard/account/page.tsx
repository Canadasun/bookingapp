"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Lock, Settings as SettingsIcon, ChevronRight, Mail } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUpload } from "@/components/ImageUpload";
import { LoadingSpinner } from "@/components/LoadingSpinner";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", avatarUrl: null as string | null });

  useEffect(() => {
    api.users.me()
      .then((u) => {
        setMe(u);
        setForm({ name: u.name ?? "", phone: u.phone ?? "", avatarUrl: u.avatarUrl ?? null });
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load your account"))
      .finally(() => setLoading(false));
  }, []);

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
            <Input type="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 555 123 4567" />
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
    </div>
  );
}
