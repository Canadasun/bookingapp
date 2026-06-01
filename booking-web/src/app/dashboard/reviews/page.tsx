"use client";

import { useEffect, useState, useCallback } from "react";
import { Star, Eye, EyeOff } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const user = getUser();
  const bizId = user?.businessId ?? "";

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoading(true);
    try { setReviews(await api.reviews.ownerList(bizId)); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  async function toggle(r: R) {
    try { await api.reviews.moderate(bizId, r.id, !r.published); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  const published = reviews.filter((r) => r.published);
  const avg = published.length ? published.reduce((s, r) => s + r.rating, 0) / published.length : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reviews</h2>
          <p className="text-sm text-gray-500">Client feedback — hide any you don&apos;t want shown publicly.</p>
        </div>
        {published.length > 0 && (
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-lg font-bold text-gray-900">{avg.toFixed(1)}</span>
            </div>
            <p className="text-xs text-gray-400">{published.length} published</p>
          </div>
        )}
      </div>
      {loading ? <LoadingSpinner /> : reviews.length === 0 ? (
        <EmptyState title="No reviews yet" />
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id} className={r.published ? "" : "opacity-60"}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-gray-900 truncate">{r.clientName}</span>
                    <span className="flex shrink-0">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={n <= r.rating ? "w-3.5 h-3.5 fill-amber-400 text-amber-400" : "w-3.5 h-3.5 text-gray-200"} />)}</span>
                  </div>
                  <button onClick={() => toggle(r)} className="text-gray-400 hover:text-violet-600 p-1.5 shrink-0" title={r.published ? "Hide" : "Show"}>
                    {r.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
                {r.comment ? <p className="text-sm text-gray-600 mt-1.5">{r.comment}</p> : null}
                <p className="text-xs text-gray-400 mt-1.5">{format(new Date(r.createdAt), "MMM d, yyyy")}{r.published ? "" : " · hidden"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
