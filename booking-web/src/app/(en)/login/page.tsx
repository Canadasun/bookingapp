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
  const ssoError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

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
        const body = await readJson<{ message?: string; code?: string }>(res);
        if (body?.code === "EMAIL_NOT_VERIFIED") {
          setUnverified(true);
          return;
        }
        throw new Error(body?.message ?? "Invalid credentials");
      }
      setUnverified(false);
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

  async function handleResend() {
    setResendLoading(true);
    try {
      await fetch("/api/auth/resend-verification-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      toast.success("Verification email sent — check your inbox.");
    } catch {
      toast.error("Could not send verification email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  }

  if (unverified) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-gray-700">
          Your email address hasn&apos;t been verified yet. We&apos;ve sent a new link to <strong>{email}</strong>.
        </p>
        <p className="text-xs text-gray-500">Didn&apos;t receive it?</p>
        <Button onClick={handleResend} loading={resendLoading} variant="outline" className="w-full">
          Resend verification email
        </Button>
        <button type="button" onClick={() => setUnverified(false)} className="text-xs text-violet-600 hover:underline">
          Back to login
        </button>
      </div>
    );
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
    <div className="space-y-4">
      {ssoError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {ssoError}
        </div>
      )}

      {/* Social sign-in */}
      <div className="space-y-2">
        <a
          href="/api/auth/google"
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
            href="/api/auth/apple"
            className="flex items-center justify-center gap-3 w-full rounded-lg border border-slate-900 bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <svg className="w-4 h-4 flex-none" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.42c1.42.07 2.4.83 3.23.85.97-.13 1.9-.89 3.13-.95 2.03.05 3.52.9 4.45 2.28-1.95 1.23-1.58 3.95.32 4.91-.48 1.37-1.11 2.74-3.13 3.77zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Continue with Apple
          </a>
        )}
      </div>

      <div className="relative flex items-center">
        <div className="flex-1 border-t border-slate-200" />
        <span className="mx-3 text-xs font-medium uppercase tracking-wide text-slate-400">or</span>
        <div className="flex-1 border-t border-slate-200" />
      </div>

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
    </div>
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
          <Link href="/" className="mt-2 inline-block text-xs font-medium text-slate-500 hover:text-violet-600 hover:underline">
            Back to homepage
          </Link>
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
