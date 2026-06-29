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
import { api } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { readPendingCheckout, clearPendingCheckout, claimCheckout } from "@/lib/pendingCheckout";
import { Gift, Copy, ArrowRight } from "lucide-react";

function ReferralPrompt({ onContinue }: { onContinue: () => void }) {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.referrals.get().then((data) => {
      if (data?.code) setReferralCode(data.code);
    }).catch(() => {});
  }, []);

  const referralUrl = referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${referralCode}`
    : null;

  function copyLink() {
    if (!referralUrl) return;
    trackEvent("referral_link_copy", { placement: "register_complete" });
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="flex items-center justify-center w-16 h-16 bg-violet-100 rounded-full mx-auto">
        <Gift className="w-8 h-8 text-violet-600" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">You&apos;re in! 🎉</h1>
        <p className="text-slate-500 text-sm mt-1">
          Know another business owner who&apos;d love Pulse?<br />
          Share your link — they&apos;ll thank you.
        </p>
      </div>

      {referralUrl ? (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your referral link</p>
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              <span className="text-xs text-slate-600 truncate flex-1">{referralUrl}</span>
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 text-violet-600 hover:text-violet-700"
                aria-label="Copy referral link"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            {copied && <p className="text-xs text-emerald-600 font-medium">Link copied!</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="h-16 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
        </div>
      )}

      <div className="space-y-2">
        <Button onClick={onContinue} className="w-full" size="lg">
          Go to my dashboard <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
        <p className="text-xs text-slate-400">You can always share your referral link from Settings</p>
      </div>
    </div>
  );
}

export default function CompleteOwnerRegistrationPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user) { router.replace("/register"); return; }
    if (user.role === "OWNER" && user.businessId) { router.replace("/dashboard"); return; }
    setReady(true);
  }, [router]);

  if (!ready) return null;

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
      trackEvent("owner_registration_complete", { method: "sso_completion" });
      // If they paid via a Payment Link before signing up with Google/Apple, the
      // session id was stashed before the OAuth redirect — claim it now.
      const pending = readPendingCheckout();
      if (pending) {
        const claim = await claimCheckout(pending);
        clearPendingCheckout();
        if (claim.ok && claim.plan && claim.plan !== "FREE") toast.success(`${claim.plan} plan activated.`);
        else if (!claim.ok) toast.error("Payment received — your plan will activate shortly. Contact support if it doesn't.");
      }
      setDone(true);
    } catch {
      toast.error("Something went wrong, please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="min-h-screen flex flex-col items-center justify-center brand-shell px-4 py-10">
      {done ? (
        <ReferralPrompt onContinue={() => router.push("/dashboard")} />
      ) : (
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
      )}
    </main>
  );
}
