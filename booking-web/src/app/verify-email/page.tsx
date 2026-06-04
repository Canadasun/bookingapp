"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  // Email verification is for business accounts; send them to their dashboard.
  const dest = { href: "/dashboard", label: "Go to your dashboard" };

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setState("error"); return; }
    api.auth.verifyEmail(token)
      .then(() => {
        setState("ok");
        // Auto-return (middleware sends them via sign-in if needed).
        setTimeout(() => router.push(dest.href), 2500);
      })
      .catch(() => setState("error"));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-8 text-center">
          {state === "loading" && (
            <>
              <Loader2 className="w-10 h-10 text-violet-600 mx-auto animate-spin" />
              <p className="text-sm text-slate-500 mt-4">Verifying your email…</p>
            </>
          )}
          {state === "ok" && (
            <>
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h1 className="text-lg font-bold text-slate-900 mt-4">Email verified</h1>
              <p className="text-sm text-slate-500 mt-1">Taking you to your account… you can also continue below.</p>
              <Link href={dest.href} className="inline-block mt-6 bg-violet-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-violet-700 transition-colors">
                {dest.label}
              </Link>
            </>
          )}
          {state === "error" && (
            <>
              <XCircle className="w-12 h-12 text-red-500 mx-auto" />
              <h1 className="text-lg font-bold text-slate-900 mt-4">Link invalid or expired</h1>
              <p className="text-sm text-slate-500 mt-1">Sign in and resend a fresh verification link from your dashboard.</p>
              <Link href="/login" className="inline-block mt-6 text-sm font-semibold text-violet-600 hover:underline">
                Sign in
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
