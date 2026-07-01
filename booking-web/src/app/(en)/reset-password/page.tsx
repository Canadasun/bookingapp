"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthLocale } from "@/lib/useAuthLocale";
import { LanguageToggle } from "@/components/marketing/LanguageToggle";

function ResetForm() {
  const fr = useAuthLocale();
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-slate-600">{fr ? "Ce lien est invalide ou expiré." : "This reset link is invalid or has expired."}</p>
        <Link href="/forgot-password" className="inline-block text-violet-600 hover:underline font-medium text-sm">
          {fr ? "Demander un nouveau lien" : "Request a new link"}
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error(fr ? "Le mot de passe doit contenir au moins 8 caractères" : "Password must be at least 8 characters"); return; }
    if (password !== confirm) { toast.error(fr ? "Les mots de passe ne correspondent pas" : "Passwords don't match"); return; }
    setLoading(true);
    try {
      const res = await fetch("/proxy/auth/reset-password", {
        method: "POST",
        // X-Requested-With satisfies the API's CSRF guard, which rejects
        // cookie-bearing requests (a stale session cookie is enough) that lack it.
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? (fr ? "Impossible de réinitialiser le mot de passe" : "Could not reset password"));
      }
      toast.success(fr ? "Mot de passe mis à jour — veuillez vous connecter." : "Password updated — please sign in.");
      router.push(`/login?lang=${fr ? "fr" : "en"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (fr ? "Impossible de réinitialiser le mot de passe" : "Could not reset password"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{fr ? "Nouveau mot de passe" : "New password"}</label>
        <div className="relative">
          <Input type={showPw ? "text" : "password"} placeholder={fr ? "Au moins 8 caractères" : "At least 8 characters"} value={password}
            onChange={(e) => setPassword(e.target.value)} required className="pr-10" autoFocus />
          <button type="button" onClick={() => setShowPw((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{fr ? "Confirmer le nouveau mot de passe" : "Confirm new password"}</label>
        <Input type="password" placeholder={fr ? "Répéter le mot de passe" : "Repeat password"} value={confirm}
          onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      <Button type="submit" loading={loading} className="w-full" size="lg">{fr ? "Mettre à jour" : "Update password"}</Button>
    </form>
  );
}

function ResetPasswordPageInner() {
  const fr = useAuthLocale();
  const searchParams = useSearchParams();
  const enParams = new URLSearchParams(searchParams.toString()); enParams.set("lang", "en");
  const frParams = new URLSearchParams(searchParams.toString()); frParams.set("lang", "fr");
  return (
    <main id="main-content" className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-center">
          <LanguageToggle locale={fr ? "fr" : "en"} enHref={`/reset-password?${enParams}`} frHref={`/reset-password?${frParams}`} label={fr ? "Langue" : "Language"} />
        </div>
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Pulse Booking" className="w-20 h-auto mx-auto" />
          </Link>
          <p className="text-slate-500 mt-2 text-sm">{fr ? "Choisissez un nouveau mot de passe" : "Choose a new password"}</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Suspense>
              <ResetForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordPageInner /></Suspense>;
}
