"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isFuture } from "date-fns";
import { Calendar, MessageSquare, Tag, LogOut, ChevronRight, Clock, AlertCircle, RefreshCw, Mail, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { api, Appointment } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { getUser, clearSession, type SessionUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Section = "upcoming" | "past" | "offers";

export default function ClientDashboard() {
  const router = useRouter();
  const [user, setUser]       = useState<SessionUser | null | undefined>(undefined); // undefined = not yet checked
  const [section, setSection] = useState<Section>("upcoming");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [offers, setOffers]   = useState<Array<{
    id: string; title: string; description: string; discount?: string;
    expiresAt?: string; business: { id: string; name: string }
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notVerified, setNotVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [hasCard, setHasCard] = useState(false);
  const [removingCard, setRemovingCard] = useState(false);

  async function removeCard() {
    if (!window.confirm("Remove your saved card? It will be deleted and can no longer be charged for deposits, no-shows or late cancellations.")) return;
    setRemovingCard(true);
    try {
      await api.clientPortal.removeCard();
      setHasCard(false);
      toast.success("Card removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove card");
    } finally { setRemovingCard(false); }
  }

  // Hydrate user from cookie on client only
  useEffect(() => {
    const u = getUser();
    setUser(u);
    if (!u || u.role !== "CLIENT") {
      router.replace("/my/login?next=/my/dashboard");
    }
  }, [router]);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [apts, offs] = await Promise.all([
        api.clientPortal.appointments(),
        api.clientPortal.offers(),
      ]);
      setAppointments(apts as Appointment[]);
      setOffers(offs);
      setNotVerified(false);
      api.clientPortal.cardStatus().then((c) => setHasCard(c.hasCard)).catch(() => {});
    } catch (e) {
      // The portal requires a verified email — show the gate instead of an error.
      if (e instanceof Error && e.message.includes("EMAIL_NOT_VERIFIED")) {
        setNotVerified(true);
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to load — try refreshing");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Only load data once we know the user is a CLIENT
  useEffect(() => {
    if (user?.role === "CLIENT") load();
  }, [user, load]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearSession();
    router.replace("/my/login");
  }

  async function resend() {
    setResending(true);
    try {
      const r = await api.auth.resendVerification();
      toast.success(r.alreadyVerified ? "Already verified — try refreshing" : "Verification email sent");
      if (r.alreadyVerified) load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resend");
    } finally {
      setResending(false);
    }
  }

  // Still checking auth
  if (user === undefined) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]"><LoadingSpinner /></div>;
  }

  // Not a client — middleware will redirect, show nothing
  if (!user || user.role !== "CLIENT") return null;

  // Email-verification gate — the portal won't return data until the email is confirmed.
  if (notVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
            <Mail className="w-6 h-6 text-amber-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 mt-4">Verify your email</h1>
          <p className="text-sm text-gray-500 mt-1">We sent a link to <strong>{user.email}</strong>. Confirm it to view your bookings and messages.</p>
          <button onClick={resend} disabled={resending}
            className="mt-6 w-full bg-violet-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors">
            {resending ? "Sending…" : "Resend verification email"}
          </button>
          <button onClick={logout} className="mt-3 text-xs text-gray-500 hover:text-gray-700">Sign out</button>
        </div>
      </div>
    );
  }

  const upcoming = appointments.filter(
    (a) => isFuture(new Date(a.startsAt)) && ["PENDING","CONFIRMED"].includes(a.status)
  );
  const past = appointments.filter(
    (a) => !isFuture(new Date(a.startsAt)) || !["PENDING","CONFIRMED"].includes(a.status)
  );

  const TABS: { id: Section; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "upcoming", label: "Upcoming",  icon: Calendar,  count: upcoming.length },
    { id: "past",     label: "Past",      icon: Clock },
    { id: "offers",   label: "Offers",    icon: Tag,       count: offers.length },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA]">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-none">My Bookings</p>
              <p className="text-xs text-gray-400 mt-0.5">{user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => load(true)}
              className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-colors">
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </button>
            <Link href="/my/messages"
              className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-colors">
              <MessageSquare className="w-4 h-4" />
            </Link>
            <button onClick={logout}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">

        {/* Book new CTA */}
        <Link href="/book"
          className="flex items-center justify-between bg-violet-600 text-white rounded-2xl p-5 hover:bg-violet-700 transition-colors group">
          <div>
            <p className="font-bold text-lg leading-tight">Book an appointment</p>
            <p className="text-violet-200 text-sm mt-0.5">Browse services and pick a time</p>
          </div>
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </div>
        </Link>

        {/* Card on file — let the client delink it any time */}
        {hasCard && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Card on file</p>
              <p className="text-xs text-gray-500 mt-0.5">A business has saved your card for deposits or no-show / late-cancellation protection. You can remove it anytime.</p>
            </div>
            <button onClick={removeCard} disabled={removingCard}
              className="shrink-0 text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 disabled:opacity-60 transition-colors">
              {removingCard ? "Removing…" : "Remove card"}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {TABS.map(({ id, label, icon: Icon, count }) => (
            <button key={id} onClick={() => setSection(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all",
                section === id ? "bg-white shadow-sm text-violet-700" : "text-gray-500 hover:text-gray-700",
              )}>
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count !== undefined && count > 0 && (
                <span className={cn(
                  "text-xs font-bold px-1.5 py-0.5 rounded-full",
                  section === id ? "bg-violet-100 text-violet-700" : "bg-gray-200 text-gray-600",
                )}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? <LoadingSpinner /> : (
          <div className="space-y-3">

            {section === "upcoming" && (
              upcoming.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-500">No upcoming appointments</p>
                    <Link href="/book" className="text-violet-600 text-sm hover:underline mt-2 inline-block font-medium">
                      Book your first appointment →
                    </Link>
                  </CardContent>
                </Card>
              ) : upcoming.map((a) => <AptCard key={a.id} apt={a} />)
            )}

            {section === "past" && (
              past.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-sm text-gray-400">No past appointments</p>
                  </CardContent>
                </Card>
              ) : past.map((a) => <AptCard key={a.id} apt={a} />)
            )}

            {section === "offers" && (
              offers.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Tag className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No active offers right now</p>
                    <p className="text-xs text-gray-300 mt-1">Check back soon!</p>
                  </CardContent>
                </Card>
              ) : offers.map((o) => (
                <Card key={o.id} className="overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
                  <CardContent className="py-4 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                      <Tag className="w-5 h-5 text-violet-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm">{o.title}</p>
                        {o.discount && (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            {o.discount}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{o.description}</p>
                      <p className="text-xs text-violet-500 mt-1 font-medium">{o.business.name}</p>
                      {o.expiresAt && (
                        <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Expires {format(new Date(o.expiresAt), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    <Link href="/book"
                      className="text-xs text-violet-600 font-semibold hover:underline shrink-0 mt-0.5">
                      Book →
                    </Link>
                  </CardContent>
                </Card>
              ))
            )}

          </div>
        )}
      </div>
    </div>
  );
}

function AptCard({ apt }: { apt: Appointment }) {
  const upcoming = isFuture(new Date(apt.startsAt)) && ["PENDING","CONFIRMED"].includes(apt.status);
  const start    = new Date(apt.startsAt);
  return (
    <Card className={cn(upcoming && "border-violet-100")}>
      <CardContent className="py-4 flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0",
          upcoming ? "bg-violet-50" : "bg-gray-50",
        )}>
          <span className={cn("text-lg font-bold leading-none", upcoming ? "text-violet-700" : "text-gray-500")}>
            {format(start, "d")}
          </span>
          <span className={cn("text-[10px] font-semibold uppercase tracking-wide", upcoming ? "text-violet-500" : "text-gray-400")}>
            {format(start, "MMM")}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{apt.service?.name}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {format(start, "HH:mm")} · {apt.staff?.user?.name}
          </p>
          {(apt as { business?: { name?: string } }).business?.name && (
            <p className="text-xs text-violet-500 mt-0.5 flex items-center gap-1.5">
              <span className="truncate">{(apt as { business?: { name?: string } }).business!.name}</span>
              {(apt as { business?: { verificationStatus?: string } }).business?.verificationStatus === "VERIFIED" && <VerifiedBadge />}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge status={apt.status} />
          {upcoming && (
            <Link href={`/appointments/${apt.id}/manage${apt.manageToken ? `?token=${encodeURIComponent(apt.manageToken)}` : ''}`}
              className="text-xs text-gray-400 hover:text-violet-600 transition-colors">
              Manage
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
