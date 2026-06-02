"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { clearSession } from "@/lib/auth";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (newPassword !== confirm) { toast.error("New passwords do not match"); return; }
    setLoading(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      // Sign the user out server-side so the HttpOnly token cookie is actually
      // cleared (clearSession alone can't remove an HttpOnly cookie), then
      // re-authenticate with the new password.
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      clearSession();
      toast.success("Password updated — please sign in again");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-6">
          <div className="w-11 h-11 rounded-xl bg-violet-600 flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <h1 className="text-lg font-bold text-slate-900">Set a new password</h1>
            <p className="text-sm text-slate-500 mb-5">For your security, choose a new password before continuing.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Current password</label>
                <Input type="password" placeholder="••••••••" value={currentPassword}
                  onChange={(e) => setCurrent(e.target.value)} required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
                <Input type="password" placeholder="At least 8 characters" value={newPassword}
                  onChange={(e) => setNew(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm new password</label>
                <Input type="password" placeholder="Re-enter new password" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" loading={loading}>Update password</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
