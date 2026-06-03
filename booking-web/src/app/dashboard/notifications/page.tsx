"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";

type Notif = { id: string; kind: string; title: string; body?: string | null; linkUrl?: string | null; read: boolean; createdAt: string };

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await api.notifications.list()); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load notifications"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function open(n: Notif) {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      api.notifications.markRead(n.id).catch(() => {});
    }
    if (n.linkUrl) router.push(n.linkUrl);
  }

  async function markAll() {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    try { await api.notifications.markAllRead(); } catch { /* optimistic */ }
  }

  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
          <p className="text-sm text-gray-500">{unread > 0 ? `${unread} unread` : "You're all caught up."}</p>
        </div>
        {unread > 0 && <Button variant="outline" size="sm" onClick={markAll}><CheckCheck className="w-4 h-4 mr-1.5" /> Mark all read</Button>}
      </div>

      {loading ? <LoadingSpinner /> : items.length === 0 ? (
        <EmptyState title="No notifications yet" description="New bookings and updates will show here." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button key={n.id} onClick={() => open(n)}
              className={cn("w-full text-left rounded-xl border p-4 transition-colors",
                n.read ? "border-gray-100 bg-white hover:bg-gray-50" : "border-violet-200 bg-violet-50/50 hover:bg-violet-50")}>
              <div className="flex items-start gap-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  n.read ? "bg-gray-100 text-gray-400" : "bg-violet-100 text-violet-600")}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm truncate", n.read ? "font-medium text-gray-700" : "font-semibold text-gray-900")}>{n.title}</p>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />}
                  </div>
                  {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
