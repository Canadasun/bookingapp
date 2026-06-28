"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";
import { formatPhoneInput } from "@/lib/utils";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ssoError = searchParams.get("error");
  const referralCode = (searchParams.get("ref") ?? searchParams.get("referral") ?? "").trim().toUpperCase();
  // Set when Stripe redirects here after a paid Payment Link checkout.
  const sessionId = searchParams.get("session_id");
  const [form, setForm] = useState({ name: "", businessName: "", phone: "", email: "", password: "", confirm: "" });
  const [terms, setTerms] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errs, setErrs] = useState<Partial<typeof form>>({});
  const [emailExists, setEmailExists] = useState(false);
  const [paidPlan, setPaidPlan] = useState<string | null>(null);

  useEffect(() => {
    if (/^PULSE-[A-Z0-9]{6}$/.test(referralCode)) {
      localStorage.setItem("pulse_referral_code", referralCode);
    }
  }, [referralCode]);

  // After a paid Payment Link checkout, prefill the email and show which plan
  // was purchased so the visitor just finishes creating their account.
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/proxy/payments/checkout-prefill?session_id=${encodeURIComponent(sessionId)}`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.paid) return;
        if (data.plan) setPaidPlan(data.plan as string);
        if (data.email) setForm((p) => (p.email ? p : { ...p, email: data.email as string }));
      })
      .catch(() => {});
  }, [sessionId]);

  function validate() {
    const e: Partial<typeof form> = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.businessName.trim()) e.businessName = "Required";
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email required";
    if (form.password.length < 8) {
      e.password = "At least 8 characters";
    } else if (!/[a-zA-Z]/.test(form.password)) {
      e.password = "Must contain at least one letter";
    } else if (!/[\d!@#$%^&*()\-_+=[\]{};':"\\|,.<>/?`~]/.test(form.password)) {
      e.password = "Must contain at least one number or special character";
    }
    if (form.password !== form.confirm) e.confirm = "Passwords don't match";
    setErrs(e);
    if (!terms) { toast.error("Please accept the Terms of Service & Privacy Policy"); return false; }
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    trackEvent("sign_up_start", {
      method: "email",
      has_referral_code: /^PULSE-[A-Z0-9]{6}$/.test(referralCode),
      selected_plan: searchParams.get("plan") ?? "unknown",
    });
    if (!validate()) return;
    setLoading(true);
    try {
      const email = form.email.trim().toLowerCase();
      // Single BFF call: registers the user and sets auth cookies from the returned tokens.
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(), email, password: form.password, role: "OWNER",
          businessName: form.businessName.trim(),
          privacyConsentAccepted: true,
          consentVersion: "2026-06-13",
          ...(form.phone.trim() ? { businessPhone: form.phone.trim() } : {}),
        }),
      });
      if (!regRes.ok) {
        const body = await regRes.json().catch(() => ({})) as Record<string, unknown>;
        const msg = typeof body.message === "string" ? body.message : "Registration failed";
        if (regRes.status === 409 || /already registered|already exists/i.test(msg)) {
          setEmailExists(true);
          toast.error("That email already has an account.");
        } else {
          toast.error(msg);
        }
        return;
      }
      toast.success("Account created! Welcome.");
      trackEvent("sign_up_complete", {
        method: "email",
        has_referral_code: /^PULSE-[A-Z0-9]{6}$/.test(referralCode),
        selected_plan: paidPlan ?? searchParams.get("plan") ?? "unknown",
      });
      // Attach the subscription they already paid for (Payment Link flow) to the
      // business just created. Best-effort: never trap the user on this screen —
      // the Stripe webhook also reconciles, so we proceed to the dashboard either way.
      if (sessionId) {
        try {
          const claimRes = await fetch("/api/payments/claim-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          if (claimRes.ok) {
            const claim = await claimRes.json().catch(() => ({})) as { plan?: string };
            if (claim?.plan && claim.plan !== "FREE") toast.success(`${claim.plan} plan activated.`);
          } else {
            toast.error("Payment received — your plan will activate shortly. Contact support if it doesn't.");
          }
        } catch {
          toast.error("Payment received — your plan will activate shortly. Contact support if it doesn't.");
        }
      }
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong, please try again");
    } finally {
      setLoading(false);
    }
  }

  const f = (k: keyof typeof form, v: string) => { setForm((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: "" })); if (k === "email") setEmailExists(false); };

  return (
    <main id="main-content" className="min-h-screen flex flex-col items-center justify-center brand-shell px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <Image src="/logo.png" alt="Pulse Booking" width={80} height={80} className="w-20 h-auto mx-auto" />
          </Link>
          <p className="text-slate-600 mt-3 text-sm">Create your business account</p>
          <Link href="/" className="mt-2 inline-block text-xs font-medium text-slate-500 hover:text-violet-600 hover:underline">
            Back to homepage
          </Link>
        </div>

        <Card>
          <CardContent className="pt-6">
            {ssoError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {ssoError}
              </div>
            )}
            {/^PULSE-[A-Z0-9]{6}$/.test(referralCode) && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Referral code saved: <span className="font-semibold tracking-wide">{referralCode}</span>
              </div>
            )}
            {paidPlan && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Payment received for the <span className="font-semibold">{paidPlan}</span> plan. Finish creating your account to activate it.
              </div>
            )}

            {/* SSO — sign up with Google or Apple */}
            <div className="space-y-2 mb-4">
              <a
                href="/api/auth/google?intent=owner"
                className="flex items-center justify-center gap-3 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <svg className="w-4 h-4 flex-none" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </a>
              {process.env.NEXT_PUBLIC_APPLE_CLIENT_ID && (
                <a
                  href="/api/auth/apple?intent=owner"
                  className="flex items-center justify-center gap-3 w-full rounded-lg border border-slate-900 bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <svg className="w-4 h-4 flex-none" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.42c1.42.07 2.4.83 3.23.85.97-.13 1.9-.89 3.13-.95 2.03.05 3.52.9 4.45 2.28-1.95 1.23-1.58 3.95.32 4.91-.48 1.37-1.11 2.74-3.13 3.77zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Continue with Apple
                </a>
              )}
              <p className="text-center text-xs text-slate-400 pt-0.5">
                By continuing you agree to our{" "}
                <Link href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Terms</Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Privacy Policy</Link>.
              </p>
            </div>

            <div className="relative flex items-center mb-4">
              <div className="flex-1 border-t border-slate-200" />
              <span className="mx-3 text-xs font-medium uppercase tracking-wide text-slate-400">or register with email</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {emailExists && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                An account with <span className="font-medium">{form.email}</span> already exists.{" "}
                <Link href={`/login`} className="font-semibold underline">Sign in</Link>{" "}or{" "}
                <Link href={`/forgot-password`} className="font-semibold underline">reset your password</Link>.
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="reg-name" className="block text-sm font-medium text-slate-700 mb-1.5">Your name</label>
                <Input id="reg-name" placeholder="Jane Smith" value={form.name} onChange={(e) => f("name", e.target.value)}
                  className={errs.name ? "border-red-400" : ""} autoFocus />
                {errs.name && <p className="text-xs text-red-500 mt-1">{errs.name}</p>}
              </div>
              <div>
                <label htmlFor="reg-business" className="block text-sm font-medium text-slate-700 mb-1.5">Business name</label>
                <Input id="reg-business" placeholder="e.g. Paws & Claws Grooming · Bliss Lash Studio" value={form.businessName} onChange={(e) => f("businessName", e.target.value)}
                  className={errs.businessName ? "border-red-400" : ""} />
                {errs.businessName && <p className="text-xs text-red-500 mt-1">{errs.businessName}</p>}
              </div>
              <div>
                <label htmlFor="reg-phone" className="block text-sm font-medium text-slate-700 mb-1.5">Business phone <span className="text-slate-400 font-normal">(optional)</span></label>
                <Input id="reg-phone" type="tel" placeholder="+1 (416) 555-0123" value={form.phone} onChange={(e) => f("phone", formatPhoneInput(e.target.value))} />
              </div>
              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <Input id="reg-email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => f("email", e.target.value)}
                  className={errs.email ? "border-red-400" : ""} />
                {errs.email && <p className="text-xs text-red-500 mt-1">{errs.email}</p>}
              </div>
              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <Input id="reg-password" type={showPw ? "text" : "password"} placeholder="Min 8 characters" value={form.password}
                    onChange={(e) => f("password", e.target.value)} className={errs.password ? "border-red-400 pr-10" : "pr-10"} />
                  <button type="button" onClick={() => setShowPw((p) => !p)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errs.password && <p className="text-xs text-red-500 mt-1">{errs.password}</p>}
              </div>
              <div>
                <label htmlFor="reg-confirm" className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
                <Input id="reg-confirm" type="password" placeholder="Repeat password" value={form.confirm}
                  onChange={(e) => f("confirm", e.target.value)} className={errs.confirm ? "border-red-400" : ""} />
                {errs.confirm && <p className="text-xs text-red-500 mt-1">{errs.confirm}</p>}
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-violet-600" />
                <span className="text-xs text-slate-500 leading-relaxed">
                  I agree to the{" "}
                  <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Terms of Service</Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Privacy Policy</Link>.
                </span>
              </label>

              <Button type="submit" loading={loading} disabled={!terms} className="w-full" size="lg">Create account</Button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-6">
              Already have an account?{" "}
              <Link href="/login" className="text-indigo-600 hover:underline font-medium">Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
