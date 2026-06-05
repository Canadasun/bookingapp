"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", businessName: "", phone: "", email: "", password: "", confirm: "" });
  const [terms, setTerms] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errs, setErrs] = useState<Partial<typeof form>>({});
  const [emailExists, setEmailExists] = useState(false);

  function validate() {
    const e: Partial<typeof form> = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.businessName.trim()) e.businessName = "Required";
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email required";
    if (form.password.length < 8) e.password = "At least 8 characters";
    if (form.password !== form.confirm) e.confirm = "Passwords don't match";
    setErrs(e);
    if (!terms) { toast.error("Please accept the Terms of Service & Privacy Policy"); return false; }
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const email = form.email.trim().toLowerCase();
      // Register creates the user then logs in
      const regRes = await fetch("/proxy/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(), email, password: form.password, role: "OWNER",
          businessName: form.businessName.trim(),
          privacyConsentAccepted: true,
          ...(form.phone.trim() ? { businessPhone: form.phone.trim() } : {}),
        }),
      });
      if (!regRes.ok) {
        const body = await regRes.json().catch(() => ({})) as Record<string, unknown>;
        const msg = typeof body.message === "string" ? body.message : "Registration failed";
        // Duplicate email: don't create a second account — point them to sign in
        // or reset their password instead.
        if (regRes.status === 409 || /already registered|already exists/i.test(msg)) {
          setEmailExists(true);
          toast.error("That email already has an account.");
        } else {
          toast.error(msg);
        }
        return;
      }
      // Use the login route to set cookies properly
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: form.password }),
      });
      if (!loginRes.ok) { toast.error("Registered but login failed — please log in manually"); router.push("/login"); return; }
      toast.success("Account created! Welcome.");
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong, please try again");
    } finally {
      setLoading(false);
    }
  }

  const f = (k: keyof typeof form, v: string) => { setForm((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: "" })); if (k === "email") setEmailExists(false); };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center brand-shell px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="w-11 h-11 rounded-2xl bg-violet-600 shadow-lg shadow-violet-200 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </span>
            <span className="text-2xl font-bold text-ink">Pulse</span>
          </Link>
          <p className="text-slate-600 mt-3 text-sm">Create your business account</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {emailExists && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                An account with <span className="font-medium">{form.email}</span> already exists.{" "}
                <Link href={`/login`} className="font-semibold underline">Sign in</Link>{" "}or{" "}
                <Link href={`/forgot-password`} className="font-semibold underline">reset your password</Link>.
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Your name</label>
                <Input placeholder="Jane Smith" value={form.name} onChange={(e) => f("name", e.target.value)}
                  className={errs.name ? "border-red-400" : ""} autoFocus />
                {errs.name && <p className="text-xs text-red-500 mt-1">{errs.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Business name</label>
                <Input placeholder="e.g. Paws & Claws Grooming · Bliss Lash Studio" value={form.businessName} onChange={(e) => f("businessName", e.target.value)}
                  className={errs.businessName ? "border-red-400" : ""} />
                {errs.businessName && <p className="text-xs text-red-500 mt-1">{errs.businessName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Business phone <span className="text-slate-400 font-normal">(optional)</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 select-none pointer-events-none z-10">+1</span>
                  <Input type="tel" className="pl-9" placeholder="555 123 4567" value={form.phone} onChange={(e) => f("phone", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <Input type="email" placeholder="you@example.com" value={form.email} onChange={(e) => f("email", e.target.value)}
                  className={errs.email ? "border-red-400" : ""} />
                {errs.email && <p className="text-xs text-red-500 mt-1">{errs.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} placeholder="Min 8 characters" value={form.password}
                    onChange={(e) => f("password", e.target.value)} className={errs.password ? "border-red-400 pr-10" : "pr-10"} />
                  <button type="button" onClick={() => setShowPw((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errs.password && <p className="text-xs text-red-500 mt-1">{errs.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
                <Input type="password" placeholder="Repeat password" value={form.confirm}
                  onChange={(e) => f("confirm", e.target.value)} className={errs.confirm ? "border-red-400" : ""} />
                {errs.confirm && <p className="text-xs text-red-500 mt-1">{errs.confirm}</p>}
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-violet-600" />
                <span className="text-xs text-slate-500 leading-relaxed">
                  I agree to the{" "}
                  <Link href="/terms" target="_blank" className="text-violet-600 hover:underline">Terms of Service</Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank" className="text-violet-600 hover:underline">Privacy Policy</Link>.
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
    </div>
  );
}
