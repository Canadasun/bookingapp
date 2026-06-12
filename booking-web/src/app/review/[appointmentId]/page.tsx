"use client";

import { useEffect, useState, use } from "react";
import { Star, Check } from "lucide-react";
import { toast } from "sonner";
import { api, Appointment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function ReviewPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = use(params);
  const [apt, setApt] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // The signed token rides in the email link's query string and authorizes both
    // loading the appointment and submitting the review.
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    api.appointments.get(appointmentId, t ?? undefined).then(setApt).catch(() => {}).finally(() => setLoading(false));
  }, [appointmentId]);

  async function submit() {
    if (!apt || rating < 1) { toast.error("Please pick a star rating"); return; }
    setSaving(true);
    try {
      await api.reviews.submit(apt.business.id, { appointmentId, rating, comment: comment || undefined, token: token ?? undefined });
      setDone(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not submit your review"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (!apt) return <div className="min-h-screen flex items-center justify-center p-6 text-center"><p className="text-gray-500">This review link is no longer valid.</p></div>;

  return (
    <main className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {done ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"><Check className="w-7 h-7 text-emerald-600" /></div>
            <h1 className="text-xl font-bold text-gray-900">Thank you! 🙏</h1>
            <p className="text-sm text-gray-500 mt-1">Your feedback helps {apt.business.name}.</p>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-bold text-gray-900">How was your visit?</h1>
            <p className="text-sm text-gray-500 mb-6">{apt.service.name} with {apt.staff.user.name} at {apt.business.name}</p>
            <div className="flex items-center justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)}>
                  <Star className={(hover || rating) >= n ? "w-9 h-9 fill-amber-400 text-amber-400" : "w-9 h-9 text-gray-300"} />
                </button>
              ))}
            </div>
            <textarea className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 mb-4 focus:outline-none focus:border-violet-400" rows={4}
              placeholder="Tell us about your experience (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
            <Button className="w-full py-6 text-base font-semibold" loading={saving} onClick={submit}>Submit review</Button>
          </>
        )}
      </div>
    </main>
  );
}
