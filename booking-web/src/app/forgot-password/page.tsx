"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      // Always 200 — the API never reveals whether the email is registered.
      await fetch("/proxy/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      toast.error("Something went wrong, please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Calendar className="w-8 h-8 text-violet-600" />
            <span className="text-2xl font-bold text-slate-900">BookingApp</span>
          </Link>
          <p className="text-slate-500 mt-2 text-sm">Reset your password</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {sent ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-slate-600">
                  If an account exists for <span className="font-medium">{email}</span>, we’ve emailed a
                  reset link. It expires in 30 minutes.
                </p>
                <Link href="/login" className="inline-block text-violet-600 hover:underline font-medium text-sm">
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <Input type="email" placeholder="you@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <Button type="submit" loading={loading} className="w-full" size="lg">Send reset link</Button>
                <p className="text-center text-sm text-slate-500">
                  Remembered it?{" "}
                  <Link href="/login" className="text-violet-600 hover:underline font-medium">Sign in</Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
