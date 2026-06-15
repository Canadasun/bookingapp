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

  function validate() {
    const e: Partial<typeof form> = {};
    if (!form.name.trim()) e.name = "Required";
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
      const regRes = await fetch("/proxy/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), email, password: form.password, role: "CLIENT", privacyConsentAccepted: true, consentVersion: "2026-06-13" }),
      });
      if (!regRes.ok) {
        const body = await readJson<{ message?: string }>(regRes);
        throw new Error(body?.message ?? "Registration failed");
      }
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: form.password }),
      });
      if (!loginRes.ok) { router.push("/my/login"); return; }
      toast.success("Account created!");
      router.push("/my/dashboard");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setLoading(false); }
  }

  const f = (k: keyof typeof form, v: string) => { setForm((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: "" })); };

  return (
    <main id="main-content" className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <Link href="/book" className="inline-block">
            <Image src="/logo.png" alt="Pulse Booking" width={80} height={80} className="w-20 h-auto mx-auto" />
          </Link>
          <p className="text-gray-400 mt-2 text-sm">Book and manage appointments in one place</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {([
                { k: "name",    label: "Full name",     type: "text",     ph: "Jane Smith" },
                { k: "email",   label: "Email",          type: "email",    ph: "jane@example.com" },
              ] as const).map(({ k, label, type, ph }) => (
                <div key={k}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                  <Input type={type} placeholder={ph} value={form[k]} onChange={(e) => f(k, e.target.value)}
                    className={errs[k] ? "border-red-400" : ""} />
                  {errs[k] && <p className="text-xs text-red-500 mt-1">{errs[k]}</p>}
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} placeholder="Min 8 characters" value={form.password}
                    onChange={(e) => f("password", e.target.value)} className={`pr-10 ${errs.password ? "border-red-400" : ""}`} />
                  <button type="button" onClick={() => setShowPw((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errs.password && <p className="text-xs text-red-500 mt-1">{errs.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
                <Input type="password" placeholder="Repeat password" value={form.confirm}
                  onChange={(e) => f("confirm", e.target.value)} className={errs.confirm ? "border-red-400" : ""} />
                {errs.confirm && <p className="text-xs text-red-500 mt-1">{errs.confirm}</p>}
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-violet-600" />
                <span className="text-xs text-gray-500 leading-relaxed">
                  I agree to the{" "}
                  <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Terms of Service</Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Privacy Policy</Link>.
                </span>
              </label>
              <Button type="submit" loading={loading} disabled={!terms} className="w-full" size="lg">Create account</Button>
            </form>
            <p className="text-center text-sm text-gray-400 mt-5">
              Have an account? <Link href="/my/login" className="text-violet-600 hover:underline font-medium">Sign in</Link>
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
