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
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errs, setErrs] = useState<Partial<typeof form>>({});

  function validate() {
    const e: Partial<typeof form> = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email required";
    if (form.password.length < 8) e.password = "At least 8 characters";
    if (form.password !== form.confirm) e.confirm = "Passwords don't match";
    setErrs(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      // Register creates the user then logs in
      const regRes = await fetch("/proxy/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: "OWNER" }),
      });
      if (!regRes.ok) {
        const body = await regRes.json().catch(() => ({})) as Record<string, unknown>;
        const msg = typeof body.message === "string" ? body.message : "Registration failed";
        toast.error(msg);
        return;
      }
      // Use the login route to set cookies properly
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
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

  const f = (k: keyof typeof form, v: string) => { setForm((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: "" })); };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Calendar className="w-8 h-8 text-indigo-600" />
            <span className="text-2xl font-bold text-slate-900">BookingApp</span>
          </Link>
          <p className="text-slate-500 mt-2 text-sm">Create your business account</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
                <Input placeholder="Jane Smith" value={form.name} onChange={(e) => f("name", e.target.value)}
                  className={errs.name ? "border-red-400" : ""} autoFocus />
                {errs.name && <p className="text-xs text-red-500 mt-1">{errs.name}</p>}
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
              <Button type="submit" loading={loading} className="w-full" size="lg">Create account</Button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-6">
              Already have an account?{" "}
              <Link href="/login" className="text-indigo-600 hover:underline font-medium">Sign in</Link>
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          By registering you accept our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
