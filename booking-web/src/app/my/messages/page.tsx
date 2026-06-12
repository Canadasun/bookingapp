"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function ClientMessagesPage() {
  const router = useRouter();
  const user = getUser();
  const [threads, setThreads] = useState<Array<{ businessId: string; businessName: string; clientId: string; messages: Array<{ id: string; content: string; fromClient: boolean; createdAt: string }> }>>([]);
  const [selected, setSelected] = useState<typeof threads[0] | null>(null);
  const [reply, setReply]   = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || user.role !== "CLIENT") { router.replace("/my/login"); return; }
  }, [user, router]);

  const load = useCallback(async () => {
    try {
      const data = await api.clientPortal.messages();
      setThreads(data);
      if (selected) {
        const updated = data.find((t) => t.businessId === selected.businessId);
        if (updated) setSelected(updated);
      }
    }
    catch { toast.error("Failed to load messages"); }
    finally { setLoading(false); }
  }, [selected]);

  useEffect(() => { 
    load(); 
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  async function send() {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      await api.messages.send(selected.businessId, selected.clientId, reply.trim());
      setReply("");
      await load();
      setTimeout(() => scrollRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 50);
    } catch { toast.error("Failed to send"); }
    finally { setSending(false); }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link href="/my/dashboard" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-sm font-bold text-gray-900">{selected ? selected.businessName : "Messages"}</h1>
        </div>
      </header>

      {!selected ? (
        <main className="max-w-2xl mx-auto px-5 py-6 space-y-3">
          {threads.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="font-medium">No messages yet</p>
              <p className="text-sm mt-1">Book an appointment and message the salon</p>
            </div>
          ) : threads.map((t) => (
            <button key={t.clientId} onClick={() => setSelected(t)}
              className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-left hover:border-violet-200 transition-colors shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">
                  {t.businessName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{t.businessName}</p>
                  <p className="text-xs text-gray-400 truncate">{t.messages[t.messages.length - 1]?.content}</p>
                </div>
              </div>
            </button>
          ))}
        </main>
      ) : (
        <main className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 65px)" }}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
            {selected.messages.map((m) => (
              <div key={m.id} className={cn("flex", m.fromClient ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                  m.fromClient ? "bg-violet-600 text-white rounded-tr-sm" : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm")}>
                  <p>{m.content}</p>
                  <p className={cn("text-xs mt-1", m.fromClient ? "text-violet-200" : "text-gray-400")}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-100 bg-white flex gap-2">
            <Input placeholder="Message…" value={reply} onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} className="flex-1" />
            <Button size="sm" onClick={send} loading={sending} disabled={!reply.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </main>
      )}
    </div>
  );
}
