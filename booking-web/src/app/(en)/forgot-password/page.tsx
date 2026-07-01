"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthLocale } from "@/lib/useAuthLocale";
import { LanguageToggle } from "@/components/marketing/LanguageToggle";

function ForgotPasswordPageInner() {
  const fr = useAuthLocale();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      // Always 200 — the API never reveals whether the email is registered.
      await fetch("/proxy/auth/forgot-password", {
        method: "POST",
        // X-Requested-With satisfies the API's CSRF guard, which rejects
        // cookie-bearing requests (a stale session cookie is enough) that lack it.
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      toast.error(fr ? "Une erreur est survenue. Veuillez réessayer." : "Something went wrong, please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-center">
          <LanguageToggle locale={fr ? "fr" : "en"} enHref="/forgot-password?lang=en" frHref="/forgot-password?lang=fr" label={fr ? "Langue" : "Language"} />
        </div>
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <Image src="/logo.png" alt="Pulse Booking" width={80} height={80} className="w-20 h-auto mx-auto" />
          </Link>
          <p className="text-slate-500 mt-2 text-sm">{fr ? "Réinitialiser votre mot de passe" : "Reset your password"}</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {sent ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-slate-600">
                  {fr ? <>Si un compte existe pour <span className="font-medium">{email}</span>, nous avons envoyé un lien de réinitialisation. Il expire dans 15 minutes.</> : <>If an account exists for <span className="font-medium">{email}</span>, we&apos;ve emailed a reset link. It expires in 15 minutes.</>}
                </p>
                <Link href="/login" className="inline-block text-violet-600 hover:underline font-medium text-sm">
                  {fr ? "Retour à la connexion" : "Back to sign in"}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700 mb-1.5">{fr ? "Courriel" : "Email"}</label>
                  <Input id="forgot-email" type="email" placeholder="you@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <Button type="submit" loading={loading} className="w-full" size="lg">{fr ? "Envoyer le lien" : "Send reset link"}</Button>
                <p className="text-center text-sm text-slate-500">
                  {fr ? "Vous vous en souvenez?" : "Remembered it?"}{" "}
                  <Link href={`/login?lang=${fr ? "fr" : "en"}`} className="text-violet-600 hover:underline font-medium">{fr ? "Se connecter" : "Sign in"}</Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return <Suspense><ForgotPasswordPageInner /></Suspense>;
}
