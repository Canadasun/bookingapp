"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { format, isFuture } from "date-fns";
import { Search, Calendar, Clock, ChevronRight, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api, Appointment, Business } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

export default function GuestLookupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [biz, setBiz]               = useState<Business | null>(null);
  const [loadingBiz, setLoadingBiz] = useState(true);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [clientName, setClientName] = useState("");
  const [bookings, setBookings]     = useState<Appointment[] | null>(null);
  const [notFound, setNotFound]     = useState(false);

  useEffect(() => {
    api.business.getBySlug(slug)
      .then(setBiz)
      .catch(() => toast.error("Business not found"))
      .finally(() => setLoadingBiz(false));
  }, [slug]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (!biz) return;
    const val = input.trim();
    if (!val) return;
    setLoading(true); setNotFound(false); setBookings(null);
    try {
      const result = await api.clients.lookup(biz.id, val);
      setClientName(result.name);
      setBookings((result.appointments as unknown as Appointment[]) ?? []);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  if (loadingBiz) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (!biz) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 text-center">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Business not found</h2>
      <Link href="/" className="text-violet-600 hover:underline">Go home</Link>
    </div>
  );

  const upcoming = bookings?.filter(
    (a) => isFuture(new Date(a.startsAt)) && ["PENDING", "CONFIRMED"].includes(a.status)
  ) ?? [];
  const past = bookings?.filter(
    (a) => !isFuture(new Date(a.startsAt)) || !["PENDING", "CONFIRMED"].includes(a.status)
  ) ?? [];

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href={`/book/${slug}`} className="flex items-center gap-2 text-gray-400 hover:text-violet-600 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Book appointment
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center">
              <Calendar className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">My Bookings</span>
          </div>
          <Link href="/my/login" className="text-sm text-violet-600 font-medium hover:underline">Sign in</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-5 py-8">

        {/* Search card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="text-center mb-5">
            <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-3">
              <Search className="w-5 h-5 text-violet-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Find your bookings</h1>
            <p className="text-sm text-gray-400 mt-1">at <strong>{biz.name}</strong></p>
            <p className="text-xs text-gray-400 mt-1">Enter the email address or phone number you booked with</p>
          </div>

          <form onSubmit={lookup} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setNotFound(false); }}
              placeholder="Email or phone number…"
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-40 transition-colors shrink-0">
              {loading ? "Looking…" : "Find"}
            </button>
          </form>

          {notFound && (
            <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-600">No bookings found for that email or phone number.</p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-50 text-center">
            <p className="text-xs text-gray-400">
              Have an account?{" "}
              <Link href="/my/login" className="text-violet-600 font-medium hover:underline">Sign in</Link>
              {" "}to see your full history and chat with us.
            </p>
          </div>
        </div>

        {/* Results */}
        {bookings !== null && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <p className="text-sm font-semibold text-gray-900">
                Found {bookings.length} booking{bookings.length !== 1 ? "s" : ""} for <span className="text-violet-700">{clientName}</span>
              </p>
            </div>

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Upcoming</p>
                <div className="space-y-2">
                  {upcoming.map((apt) => (
                    <BookingCard key={apt.id} apt={apt} />
                  ))}
                </div>
              </section>
            )}

            {/* Past */}
            {past.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Past bookings</p>
                <div className="space-y-2">
                  {past.map((apt) => (
                    <BookingCard key={apt.id} apt={apt} past />
                  ))}
                </div>
              </section>
            )}

            {bookings.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                <p className="text-gray-500">No bookings found yet.</p>
                <Link href={`/book/${slug}`}
                  className="inline-block mt-4 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors">
                  Book an appointment
                </Link>
              </div>
            )}

            <div className="text-center pt-2">
              <Link href={`/book/${slug}`}
                className="inline-flex items-center gap-1.5 text-sm text-violet-600 font-medium hover:underline">
                <Calendar className="w-4 h-4" /> Book a new appointment
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function BookingCard({ apt, past = false }: { apt: Appointment; past?: boolean }) {
  const start = new Date(apt.startsAt);
  const canManage = ["PENDING", "CONFIRMED"].includes(apt.status) && isFuture(start);

  return (
    <div className={cn(
      "bg-white rounded-xl border shadow-sm p-4 flex items-start gap-4 transition-colors",
      past ? "border-gray-100 opacity-70" : "border-gray-100 hover:border-violet-200",
    )}>
      {/* Date block */}
      <div className="w-12 shrink-0 text-center">
        <p className="text-xs font-semibold text-gray-400 uppercase">{format(start, "MMM")}</p>
        <p className="text-2xl font-bold text-gray-900 leading-none">{format(start, "d")}</p>
        <p className="text-xs text-gray-400">{format(start, "EEE")}</p>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="text-sm font-semibold text-gray-900">{apt.service.name}</p>
          <StatusBadge status={apt.status} />
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(start, "h:mm a")}</span>
          <span>with {apt.staff?.user?.name}</span>
        </div>
        <p className="text-xs font-semibold text-violet-700 mt-1">
          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(apt.service.priceCents / 100)}
        </p>
      </div>

      {/* Action */}
      {canManage && (
        <Link href={`/appointments/${apt.id}/manage${apt.manageToken ? `?token=${encodeURIComponent(apt.manageToken)}` : ''}`}
          className="flex items-center gap-1 text-xs text-violet-600 font-medium hover:underline shrink-0 mt-1">
          Manage <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}
