"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Calendar, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

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
        const body = await res.json() as { message?: string };
        throw new Error(body.message ?? "Invalid credentials");
      }
      router.push(next.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
        <Input type="email" placeholder="you@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-slate-700">Password</label>
          <Link href="/forgot-password" className="text-xs text-violet-600 hover:underline font-medium">Forgot password?</Link>
        </div>
        <div className="relative">
          <Input type={showPw ? "text" : "password"} placeholder="••••••••" value={password}
            onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
          <button type="button" onClick={() => setShowPw((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" loading={loading} className="w-full" size="lg">Sign in</Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Calendar className="w-8 h-8 text-indigo-600" />
            <span className="text-2xl font-bold text-slate-900">BookingApp</span>
          </Link>
          <p className="text-slate-500 mt-2 text-sm">Sign in to your dashboard</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Suspense>
              <LoginForm />
            </Suspense>

            <p className="text-center text-sm text-gray-500 mt-6">
              Want to book an appointment?{" "}
              <Link href="/book" className="text-violet-600 hover:underline font-medium">Book here</Link>
            </p>
            <p className="text-center text-xs text-gray-300 mt-3">
              <Link href="/register" className="hover:text-gray-400 transition-colors">Create business account</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
