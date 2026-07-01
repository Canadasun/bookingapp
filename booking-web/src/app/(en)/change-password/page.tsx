"use client";

import { useEffect, useState } from "react";
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
  const [fr, setFr] = useState(false);

  useEffect(() => {
    try {
      setFr(localStorage.getItem("pulse_dashboard_locale") === "fr");
    } catch {}
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error(fr ? "Le nouveau mot de passe doit contenir au moins 8 caractères" : "New password must be at least 8 characters"); return; }
    if (newPassword !== confirm) { toast.error(fr ? "Les nouveaux mots de passe ne correspondent pas" : "New passwords do not match"); return; }
    setLoading(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      // Sign the user out server-side so the HttpOnly token cookie is actually
      // cleared (clearSession alone can't remove an HttpOnly cookie), then
      // re-authenticate with the new password.
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      clearSession();
      toast.success(fr ? "Mot de passe mis à jour — veuillez vous reconnecter" : "Password updated — please sign in again");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (fr ? "Impossible de modifier le mot de passe" : "Could not change password"));
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
            <h1 className="text-lg font-bold text-slate-900">{fr ? "Définir un nouveau mot de passe" : "Set a new password"}</h1>
            <p className="text-sm text-slate-500 mb-5">{fr ? "Pour votre sécurité, choisissez un nouveau mot de passe avant de continuer." : "For your security, choose a new password before continuing."}</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{fr ? "Mot de passe actuel" : "Current password"}</label>
                <Input type="password" placeholder="••••••••" value={currentPassword}
                  onChange={(e) => setCurrent(e.target.value)} required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{fr ? "Nouveau mot de passe" : "New password"}</label>
                <Input type="password" placeholder={fr ? "Au moins 8 caractères" : "At least 8 characters"} value={newPassword}
                  onChange={(e) => setNew(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{fr ? "Confirmer le nouveau mot de passe" : "Confirm new password"}</label>
                <Input type="password" placeholder={fr ? "Saisissez à nouveau le mot de passe" : "Re-enter new password"} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" loading={loading}>{fr ? "Mettre à jour le mot de passe" : "Update password"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
