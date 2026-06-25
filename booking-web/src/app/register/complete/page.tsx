"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { getUser } from "@/lib/auth";

export default function CompleteOwnerRegistrationPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const user = getUser();
    if (!user) { router.replace("/register"); return; }
    if (user.role === "OWNER" && user.businessId) { router.replace("/dashboard"); }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) { setErr("Please enter your business name"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/complete-owner-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: businessName.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        toast.error(typeof body.message === "string" ? body.message : "Registration failed");
        return;
      }
      toast.success("Business created! Welcome to Pulse.");
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong, please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="min-h-screen flex flex-col items-center justify-center brand-shell px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <Image src="/logo.png" alt="Pulse Booking" width={80} height={80} className="w-20 h-auto mx-auto" />
          </Link>
          <h1 className="text-xl font-semibold text-slate-900 mt-4">One last step</h1>
          <p className="text-slate-600 mt-1 text-sm">What&apos;s your business called?</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="complete-business" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Business name
                </label>
                <Input
                  id="complete-business"
                  placeholder="e.g. Paws & Claws Grooming · Bliss Lash Studio"
                  value={businessName}
                  onChange={(e) => { setBusinessName(e.target.value); setErr(""); }}
                  className={err ? "border-red-400" : ""}
                  autoFocus
                />
                {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
              </div>
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Create my business
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
