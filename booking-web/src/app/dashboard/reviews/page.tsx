"use client";

import { useEffect, useState, useCallback } from "react";
import { Star, Eye, EyeOff, Copy, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";

type R = { id: string; clientName: string; rating: number; comment?: string | null; published: boolean; createdAt: string };

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<R[]>([]);
  const [businessSlug, setBusinessSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const user = getUser();
  const bizId = user?.businessId ?? "";

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoadError("");
    setLoading(true);
    try {
      const [reviewRows, business] = await Promise.all([
        api.reviews.ownerList(bizId),
        api.business.get(bizId),
      ]);
      setReviews(reviewRows);
      setBusinessSlug(business.slug);
    }
    catch (e) { setLoadError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  async function toggle(r: R) {
    try { await api.reviews.moderate(bizId, r.id, !r.published); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  const published = reviews.filter((r) => r.published);
  const avg = published.length ? published.reduce((s, r) => s + r.rating, 0) / published.length : 0;
  const hidden = reviews.length - published.length;
  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: published.filter((r) => r.rating === rating).length,
  }));
  const reviewUrl = typeof window !== "undefined" && businessSlug
    ? `${window.location.origin}/book/${businessSlug}`
    : "";

  async function copyPublicLink() {
    if (!reviewUrl) return;
    await navigator.clipboard.writeText(reviewUrl);
    toast.success("Public review link copied");
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reviews</h2>
          <p className="text-sm text-gray-500">Manage public feedback and protect your business reputation.</p>
        </div>
        {reviewUrl && (
          <div className="flex items-center gap-2">
            <button onClick={copyPublicLink} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Copy className="h-4 w-4" /> Copy link
            </button>
            <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700">
              <ExternalLink className="h-4 w-4" /> Public page
            </a>
          </div>
        )}
      </div>
      {loadError ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3">{loadError}</p>
          <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">Retry</button>
        </div>
      ) : loading ? <LoadingSpinner /> : reviews.length === 0 ? (
        <EmptyState title="No reviews yet" description="Mark completed appointments to send signed review requests automatically." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardContent className="py-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Public rating</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-5xl font-bold text-gray-900">{avg.toFixed(1)}</span>
                  <span className="pb-2 text-sm text-gray-400">/ 5</span>
                </div>
                <div className="mt-2 flex">
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={n <= Math.round(avg) ? "w-5 h-5 fill-amber-400 text-amber-400" : "w-5 h-5 text-gray-200"} />)}
                </div>
                <p className="mt-2 text-sm text-gray-500">{published.length} published · {hidden} hidden</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Rating breakdown</p>
                {distribution.map((row) => {
                  const pct = published.length ? Math.round((row.count / published.length) * 100) : 0;
                  return (
                    <div key={row.rating} className="grid grid-cols-[28px_1fr_36px] items-center gap-2 text-sm">
                      <span className="font-medium text-gray-700">{row.rating}</span>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-right text-xs text-gray-400">{row.count}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            {reviews.map((r) => (
              <Card key={r.id} className={r.published ? "" : "opacity-70"}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">{r.clientName}</span>
                        <span className="flex shrink-0">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={n <= r.rating ? "w-3.5 h-3.5 fill-amber-400 text-amber-400" : "w-3.5 h-3.5 text-gray-200"} />)}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{format(new Date(r.createdAt), "MMM d, yyyy")}{r.published ? " · public" : " · hidden"}</p>
                    </div>
                    <button onClick={() => toggle(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:border-violet-300 hover:text-violet-700 shrink-0">
                      {r.published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {r.published ? "Hide" : "Publish"}
                    </button>
                  </div>
                  {r.comment ? <p className="text-sm text-gray-600 mt-3 leading-relaxed">{r.comment}</p> : <p className="text-sm text-gray-400 mt-3">No written comment.</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
