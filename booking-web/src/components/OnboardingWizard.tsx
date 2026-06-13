"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, ChevronRight, X } from "lucide-react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
}

const DISMISSED_KEY = "pulse_onboarding_dismissed";

export function OnboardingWizard() {
  const bizId = getUser()?.businessId ?? "";
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>([]);
  const [dismissed, setDismissed] = useState(true); // start hidden until check is done
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bizId) return;
    if (typeof window !== "undefined" && localStorage.getItem(DISMISSED_KEY) === "1") { setLoading(false); return; }
    check();
  }, [bizId]);

  async function check() {
    try {
      const [services, staff, biz] = await Promise.all([
        api.services.list(bizId!).catch(() => [] as unknown[]),
        api.staff.list(bizId!).catch(() => [] as unknown[]),
        api.business.get(bizId!).catch(() => null),
      ]);
      const hasServices = Array.isArray(services) && services.length > 0;
      const hasStaff = Array.isArray(staff) && staff.length > 0;
      const hasStripe = !!(biz as { stripeConnectOnboarded?: boolean } | null)?.stripeConnectOnboarded;

      const built: Step[] = [
        { id: "services", title: "Add your first service", description: "Define what you offer — haircut, massage, cleaning, etc.", href: "/dashboard/services", done: hasServices },
        { id: "staff", title: "Set up your staff & hours", description: "Add yourself or team members and set working hours.", href: "/dashboard/staff", done: hasStaff },
        { id: "stripe", title: "Connect Stripe to get paid", description: "Accept deposits, card payments, and no-show fees.", href: "/dashboard/settings?tab=payouts", done: hasStripe },
        { id: "share", title: "Share your booking link", description: "Post it on Instagram, Google, or anywhere clients find you.", href: "/dashboard/settings?tab=online", done: false },
      ];

      const coreDone = built.slice(0, 3).every(s => s.done);
      if (coreDone) { setLoading(false); return; }
      setSteps(built);
      setDismissed(false);
    } catch {
      // silently skip if checks fail
    } finally {
      setLoading(false);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  if (loading || dismissed || steps.length === 0) return null;

  const completedCount = steps.filter(s => s.done).length;
  const pct = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="mx-4 mt-4 sm:mx-6 bg-gradient-to-br from-violet-50 to-white border border-violet-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-bold text-gray-900 text-sm">Get your business ready</h2>
          <p className="text-xs text-gray-500 mt-0.5">{completedCount} of {steps.length} steps complete</p>
        </div>
        <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 mt-0.5"><X className="w-4 h-4" /></button>
      </div>

      <div className="h-1.5 bg-violet-100 rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-2">
        {steps.map(step => (
          <button
            key={step.id}
            onClick={() => router.push(step.href)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors",
              step.done ? "opacity-60" : "hover:bg-violet-50"
            )}
          >
            {step.done ? <CheckCircle2 className="w-5 h-5 text-violet-500 shrink-0" /> : <Circle className="w-5 h-5 text-gray-300 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium", step.done ? "line-through text-gray-400" : "text-gray-900")}>{step.title}</p>
              {!step.done && <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>}
            </div>
            {!step.done && <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );
}
