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
  const next = searchParams.get("next") ?? "/my/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

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
        const body = await res.json() as { message?: string };
        throw new Error(body.message ?? "Invalid credentials");
      }
      const { user } = await res.json() as { user: { role: string } };
      if (user.role !== "CLIENT") {
        toast.error("This is the client portal. Business owners please use the main login.");
        return;
      }
      router.push(next.startsWith("/") ? next : "/my/dashboard");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Login failed"); }
    finally { setLoading(false); }
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
          <button type="button" onClick={() => setShowPw((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
          <p className="text-gray-400 mt-2 text-sm">Sign in to manage your appointments</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Suspense><LoginForm /></Suspense>
            <p className="text-center text-xs text-gray-300 mt-5">
              <Link href="/my/register" className="hover:text-gray-400 transition-colors">Create account</Link>
            </p>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-gray-400 mt-4">
          Business owner?{" "}
          <Link href="/login" className="text-violet-500 hover:underline">Sign in here</Link>
        </p>
      </div>
    </div>
  );
}
