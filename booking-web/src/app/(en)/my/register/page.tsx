"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageToggle } from "@/components/marketing/LanguageToggle";
import { useAuthLocale } from "@/lib/useAuthLocale";

async function readJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const fr = useAuthLocale();
  const ssoError = params.get("error");
  const [form, setForm] = useState({
    name: params.get("name") ?? "",
    email: params.get("email") ?? "",
    password: "",
    confirm: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errs, setErrs] = useState<Partial<typeof form>>({});
  const enParams = new URLSearchParams(params.toString()); enParams.delete("lang");
  const frParams = new URLSearchParams(params.toString()); frParams.set("lang", "fr");
  const enHref = `/my/register${enParams.toString() ? `?${enParams}` : ""}`;
  const frHref = `/my/register?${frParams}`;

  function validate() {
    const e: Partial<typeof form> = {};
    if (!form.name.trim()) e.name = fr ? "Requis" : "Required";
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = fr ? "Courriel valide requis" : "Valid email required";
    if (form.password.length < 8) {
      e.password = fr ? "Au moins 8 caractères" : "At least 8 characters";
    } else if (!/[a-zA-Z]/.test(form.password)) {
      e.password = fr ? "Doit contenir au moins une lettre" : "Must contain at least one letter";
    } else if (!/[\d!@#$%^&*()\-_+=[\]{};':"\\|,.<>/?`~]/.test(form.password)) {
      e.password = fr ? "Doit contenir au moins un chiffre ou un caractère spécial" : "Must contain at least one number or special character";
    }
    if (form.password !== form.confirm) e.confirm = fr ? "Les mots de passe ne correspondent pas" : "Passwords don't match";
    setErrs(e);
    if (!terms) { toast.error(fr ? "Veuillez accepter les conditions d’utilisation et la politique de confidentialité" : "Please accept the Terms of Service & Privacy Policy"); return false; }
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const email = form.email.trim().toLowerCase();
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), email, password: form.password, role: "CLIENT", privacyConsentAccepted: true, consentVersion: "2026-06-13" }),
      });
      if (!regRes.ok) {
        const body = await readJson<{ message?: string }>(regRes);
        throw new Error(body?.message ?? (fr ? "Échec de l’inscription" : "Registration failed"));
      }
      toast.success(fr ? "Compte créé!" : "Account created!");
      router.push("/my/dashboard");
    } catch (err) { toast.error(err instanceof Error ? err.message : (fr ? "Échec" : "Failed")); }
    finally { setLoading(false); }
  }

  const f = (k: keyof typeof form, v: string) => { setForm((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: "" })); };

  return (
    <main id="main-content" className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-4">
          <LanguageToggle locale={fr ? "fr" : "en"} enHref={enHref} frHref={frHref} label={fr ? "Langue" : "Language"} />
        </div>

        <div className="text-center mb-8">
          <Link href="/book" className="inline-block">
            <Image src="/logo.png" alt="Pulse Booking" width={80} height={80} className="w-20 h-auto mx-auto" />
          </Link>
          <p className="text-gray-400 mt-2 text-sm">{fr ? "Réservez et gérez vos rendez-vous au même endroit" : "Book and manage appointments in one place"}</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            {ssoError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4" role="alert">
                {ssoError}
              </div>
            )}

            {/* Social sign-up — SSO creates a CLIENT account automatically */}
            <div className="space-y-2 mb-4">
              <a
                href={`/api/auth/google?intent=register${fr ? "&lang=fr" : ""}`}
                className="flex items-center justify-center gap-3 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <svg className="w-4 h-4 flex-none" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {fr ? "S’inscrire avec Google" : "Sign up with Google"}
              </a>
              <a
                href={`/api/auth/apple?intent=register${fr ? "&lang=fr" : ""}`}
                className="flex items-center justify-center gap-3 w-full rounded-lg border border-gray-900 bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <svg className="w-4 h-4 flex-none" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.42c1.42.07 2.4.83 3.23.85.97-.13 1.9-.89 3.13-.95 2.03.05 3.52.9 4.45 2.28-1.95 1.23-1.58 3.95.32 4.91-.48 1.37-1.11 2.74-3.13 3.77zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                {fr ? "S’inscrire avec Apple" : "Sign up with Apple"}
              </a>
            </div>

            <p className="text-center text-xs text-gray-400 mb-4">
              {fr ? "En continuant avec Google ou Apple, vous acceptez nos " : "By continuing with Google or Apple you agree to our "}
              <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Terms</Link>
              {fr ? " et " : " and "}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Privacy Policy</Link>.
            </p>

            <div className="relative flex items-center mb-4">
              <div className="flex-1 border-t border-gray-200" />
              <span className="mx-3 text-xs font-medium uppercase tracking-wide text-gray-400">{fr ? "ou" : "or"}</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="creg-name" className="block text-sm font-medium text-gray-700 mb-1.5">{fr ? "Nom complet" : "Full name"}</label>
                <Input id="creg-name" type="text" placeholder={fr ? "Jane Smith" : "Jane Smith"} value={form.name} onChange={(e) => f("name", e.target.value)}
                  className={errs.name ? "border-red-400" : ""} />
                {errs.name && <p className="text-xs text-red-500 mt-1">{errs.name}</p>}
              </div>
              <div>
                <label htmlFor="creg-email" className="block text-sm font-medium text-gray-700 mb-1.5">{fr ? "Courriel" : "Email"}</label>
                <Input id="creg-email" type="email" placeholder={fr ? "jane@example.com" : "jane@example.com"} value={form.email} onChange={(e) => f("email", e.target.value)}
                  className={errs.email ? "border-red-400" : ""} />
                {errs.email && <p className="text-xs text-red-500 mt-1">{errs.email}</p>}
              </div>
              <div>
                <label htmlFor="creg-password" className="block text-sm font-medium text-gray-700 mb-1.5">{fr ? "Mot de passe" : "Password"}</label>
                <div className="relative">
                  <Input id="creg-password" type={showPw ? "text" : "password"} placeholder={fr ? "Min. 8 caractères" : "Min 8 characters"} value={form.password}
                    onChange={(e) => f("password", e.target.value)} className={`pr-10 ${errs.password ? "border-red-400" : ""}`} />
                  <button type="button" onClick={() => setShowPw((p) => !p)}
                    aria-label={showPw ? (fr ? "Masquer le mot de passe" : "Hide password") : (fr ? "Afficher le mot de passe" : "Show password")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errs.password && <p className="text-xs text-red-500 mt-1">{errs.password}</p>}
              </div>
              <div>
                <label htmlFor="creg-confirm" className="block text-sm font-medium text-gray-700 mb-1.5">{fr ? "Confirmer le mot de passe" : "Confirm password"}</label>
                <Input id="creg-confirm" type="password" placeholder={fr ? "Répétez le mot de passe" : "Repeat password"} value={form.confirm}
                  onChange={(e) => f("confirm", e.target.value)} className={errs.confirm ? "border-red-400" : ""} />
                {errs.confirm && <p className="text-xs text-red-500 mt-1">{errs.confirm}</p>}
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-violet-600" />
                <span className="text-xs text-gray-500 leading-relaxed">
                  {fr ? "J’accepte les " : "I agree to the "}
                  <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Terms of Service</Link>{" "}
                  {fr ? " et " : " and "}
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Privacy Policy</Link>.
                </span>
              </label>
              <Button type="submit" loading={loading} disabled={!terms} className="w-full" size="lg">{fr ? "Créer un compte" : "Create account"}</Button>
            </form>
            <p className="text-center text-sm text-gray-400 mt-5">
              {fr ? "Vous avez déjà un compte? " : "Have an account? "}<Link href="/my/login" className="text-violet-600 hover:underline font-medium">{fr ? "Se connecter" : "Sign in"}</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function ClientRegisterPage() {
  return <Suspense><RegisterForm /></Suspense>;
}
