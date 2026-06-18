"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/utils";
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // 2FA step: set once the password check passes for an account with 2FA on.
  const [challenge, setChallenge] = useState<{ id: string; method: string; isAdmin?: boolean } | null>(null);
  const [code, setCode] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false); // enter a recovery code instead of the OTP
  const [recovery, setRecovery] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true); // skip 2FA on this device next time

  function go() {
    const role = getUser()?.role;
    const home = role === "ADMIN" ? "/admin" : role === "CLIENT" ? "/my/dashboard" : "/dashboard";
    // Honour an explicit deep-link (?next) to a real page; otherwise the home.
    if (next && next !== "/dashboard" && next !== "/") { router.push(safeNextPath(next, home)); return; }
    router.push(home);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
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
      const data = await readJson<{ twoFactorRequired?: boolean; challengeId?: string; method?: string; isAdmin?: boolean }>(res);
      if (data?.twoFactorRequired && data.challengeId) {
        setChallenge({ id: data.challengeId, method: data.method ?? "EMAIL", isAdmin: data.isAdmin });
        return;
      }
      go();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    const entered = recoveryMode ? recovery.trim() : code.trim();
    if (entered.length < 4) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id, code: entered, rememberDevice }),
      });
      if (!res.ok) {
        const body = await readJson<{ message?: string }>(res);
        throw new Error(body?.message ?? "Invalid or expired code");
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
          <h2 className="text-sm font-semibold text-slate-900">
            {recoveryMode ? "Enter a recovery code" : "Enter your verification code"}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {recoveryMode
              ? "Enter one of the one-time recovery codes you saved when you turned on two-factor sign-in."
              : `We sent a 6-digit code to your ${challenge.method === "SMS" ? "phone" : "email"}. It expires in 10 minutes.`}
          </p>
        </div>
        {recoveryMode ? (
          <Input
            aria-label="Recovery code"
            autoComplete="off"
            placeholder="xxxxx-xxxxx"
            value={recovery}
            onChange={(e) => setRecovery(e.target.value.trim())}
            required
            autoFocus
            className="text-center text-lg tracking-[0.2em]"
          />
        ) : (
          <Input
            aria-label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            autoFocus
            className="text-center text-lg tracking-[0.4em]"
          />
        )}
        {!challenge.isAdmin && (
          <label className="flex items-center gap-2 text-xs text-slate-600 select-none cursor-pointer">
            <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} className="rounded border-slate-300" />
            Remember this device for 30 days (skip codes here)
          </label>
        )}
        <Button type="submit" loading={loading} className="w-full" size="lg">Verify &amp; sign in</Button>
        <button
          type="button"
          onClick={() => setRecoveryMode((m) => !m)}
          className="w-full text-center text-xs text-violet-600 hover:underline font-medium"
        >
          {recoveryMode ? "Use the code we sent instead" : "Lost access? Use a recovery code"}
        </button>
        <button
          type="button"
          onClick={() => { setChallenge(null); setCode(""); setRecovery(""); setRecoveryMode(false); }}
          className="w-full text-center text-xs text-slate-500 hover:text-slate-700"
        >
          ← Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
        <Input id="login-email" type="email" placeholder="you@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </div>
      <div>
        <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
        <div className="relative">
          <Input id="login-password" type={showPw ? "text" : "password"} placeholder="••••••••" value={password}
            onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
          <button type="button" onClick={() => setShowPw((p) => !p)}
            aria-label={showPw ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex justify-end mt-1.5">
          <Link href="/forgot-password" className="text-xs text-violet-600 hover:underline font-medium">Forgot password?</Link>
        </div>
      </div>
      <Button type="submit" loading={loading} className="w-full" size="lg">Sign in</Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main id="main-content" className="min-h-screen flex flex-col items-center justify-center brand-shell px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <Image src="/logo.png" alt="Pulse Booking" width={80} height={80} className="w-20 h-auto mx-auto" />
          </Link>
          <p className="text-slate-600 mt-3 text-sm">Sign in to your dashboard</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Suspense>
              <LoginForm />
            </Suspense>

            <p className="text-center text-xs text-gray-500 mt-6">
              <Link href="/register" className="text-violet-600 hover:underline font-medium transition-colors">Create business account</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
