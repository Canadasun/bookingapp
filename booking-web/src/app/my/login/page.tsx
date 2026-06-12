"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Calendar, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { safeNextPath } from "@/lib/utils";

async function readJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/my/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<{ id: string; method: string } | null>(null);
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);

  function go() {
    router.push(safeNextPath(next, "/my/dashboard"));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await readJson<{ message?: string }>(res);
        throw new Error(body?.message ?? "Invalid credentials");
      }
      const data = await readJson<{ twoFactorRequired?: boolean; challengeId?: string; method?: string; user?: { role: string } }>(res);
      if (data?.twoFactorRequired && data.challengeId) {
        setChallenge({ id: data.challengeId, method: data.method ?? "EMAIL" });
        return;
      }
      const user = data?.user;
      if (!user) throw new Error("Login did not return a user session");
      if (user.role !== "CLIENT") {
        toast.error("This is the client portal. Business owners please use the main login.");
        return;
      }
      go();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Login failed"); }
    finally { setLoading(false); }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge || code.trim().length < 4) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id, code: code.trim(), rememberDevice }),
      });
      if (!res.ok) {
        const body = await readJson<{ message?: string }>(res);
        throw new Error(body?.message ?? "Invalid or expired code");
      }
      const data = await readJson<{ user?: { role: string } }>(res);
      if (data?.user?.role !== "CLIENT") {
        toast.error("This is the client portal. Business owners please use the main login.");
        return;
      }
      go();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  if (challenge) {
    return (
      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Enter your verification code</h2>
          <p className="text-xs text-gray-500 mt-1">
            We sent a 6-digit code to your {challenge.method === "SMS" ? "phone" : "email"}.
          </p>
        </div>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
          autoFocus
          className="text-center text-lg tracking-[0.4em]"
        />
        <label className="flex items-center gap-2 text-xs text-gray-600 select-none cursor-pointer">
          <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} className="rounded border-gray-300" />
          Remember this device for 30 days
        </label>
        <Button type="submit" loading={loading} className="w-full" size="lg">Verify &amp; sign in</Button>
        <button
          type="button"
          onClick={() => { setChallenge(null); setCode(""); }}
          className="w-full text-center text-xs text-gray-500 hover:text-gray-700"
        >
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
        <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
        <div className="relative">
          <Input type={showPw ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
          <button type="button" onClick={() => setShowPw((p) => !p)} aria-label={showPw ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" loading={loading} className="w-full" size="lg">Sign in</Button>
    </form>
  );
}

export default function ClientLoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/book" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">My Bookings</span>
          </Link>
          <p className="text-gray-600 mt-2 text-sm">Sign in to manage your appointments</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Suspense><LoginForm /></Suspense>
            <p className="text-center text-xs text-gray-600 mt-5">
              <Link href="/my/register" className="hover:text-gray-700 transition-colors">Create account</Link>
            </p>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-gray-400 mt-4">
          Business owner?{" "}
          <Link href="/login" className="text-violet-500 hover:underline">Sign in to your account</Link>
        </p>
      </div>
    </div>
  );
}
