"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Trash2, Mail, Phone, CalendarPlus, Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";

type Entry = { id: string; name: string; email: string; phone?: string | null; serviceId?: string | null; desiredDate?: string | null; notes?: string | null; createdAt: string };

export default function WaitlistPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const user = getUser();
  const bizId = user?.businessId ?? "";

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoading(true);
    try { setEntries(await api.waitlist.list(bizId)); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    if (!confirm("Remove this person from the waitlist?")) return;
    try { await api.waitlist.remove(bizId, id); toast.success("Removed"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Waitlist</h2>
        <p className="text-sm text-gray-500">Clients waiting for an opening — they&apos;re emailed automatically when a matching appointment is cancelled.</p>
      </div>
      {loading ? <LoadingSpinner /> : entries.length === 0 ? (
        <EmptyState title="No one on the waitlist yet" />
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <Card key={e.id}>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-semibold text-sm shrink-0">
                  {e.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{e.name}</p>
                  <p className="text-sm text-gray-500 truncate">{e.email}{e.phone ? ` · ${e.phone}` : ""}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Joined {format(new Date(e.createdAt), "MMM d")}
                    {e.desiredDate ? ` · prefers ${format(new Date(e.desiredDate), "MMM d")}` : ""}
                  </p>
                  {e.notes ? <p className="text-xs text-gray-400 mt-0.5 italic">“{e.notes}”</p> : null}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {e.phone && <a href={`tel:${e.phone}`} className="text-gray-400 hover:text-emerald-600 p-2" title="Call"><Phone className="w-4 h-4" /></a>}
                  <a href={`mailto:${e.email}`} className="text-gray-400 hover:text-violet-600 p-2" title="Email"><Mail className="w-4 h-4" /></a>
                  <a href={`mailto:${e.email}?subject=${encodeURIComponent("A booking spot is available")}&body=${encodeURIComponent(`Hi ${e.name}, a spot may be available. Reply to this email or book online if the time works for you.`)}`} className="text-gray-400 hover:text-blue-600 p-2" title="Notify"><Send className="w-4 h-4" /></a>
                  <Link href="/dashboard/appointments" className="text-gray-400 hover:text-violet-600 p-2" title="Book"><CalendarPlus className="w-4 h-4" /></Link>
                  <button onClick={() => remove(e.id)} className="text-gray-400 hover:text-red-600 p-2" title="Remove"><Trash2 className="w-4 h-4" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
