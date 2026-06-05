"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

interface Thread { clientId: string; client: { id: string; name: string; email: string }; lastMessage: string; fromClient: boolean; read: boolean; createdAt: string }
interface Message { id: string; content: string; fromClient: boolean; read: boolean; createdAt: string }

export default function MessagesPage() {
  const [threads, setThreads]   = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [msgs, setMsgs]         = useState<Message[]>([]);
  const [reply, setReply]       = useState("");
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [plan, setPlan]         = useState<string>("FREE");
  const scrollRef = useRef<HTMLDivElement>(null);

  const user = getUser();
  const bizId = user?.businessId ?? "";

  const loadThreads = useCallback(async () => {
    if (!bizId) {
      setLoading(false);
      return;
    }
    try {
      const [threadData, bizData] = await Promise.all([
        api.messages.threads(bizId),
        api.business.get(bizId).catch(() => ({ plan: "FREE" }))
      ]);
      setThreads(threadData);
      setPlan(bizData.plan);
    }
    catch { toast.error("Failed to load messages"); }
    finally { setLoading(false); }
  }, [bizId]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  async function openThread(t: Thread) {
    if (!bizId) return;
    setSelected(t);
    try {
      const data = await api.messages.thread(bizId, t.clientId);
      setMsgs(data);
      await api.messages.markRead(bizId, t.clientId);
      loadThreads();
    } catch { toast.error("Failed to load thread"); }
    setTimeout(() => scrollRef.current?.scrollTo({ top: 9999 }), 80);
  }

  async function send() {
    if (!reply.trim() || !selected || !bizId) return;
    if (plan === "FREE") {
      toast.error("Messaging is a paid feature. Please upgrade to reply.");
      return;
    }
    setSending(true);
    try {
      const res = await api.messages.reply(bizId, selected.clientId, reply.trim());
      setReply("");
      const data = await api.messages.thread(bizId, selected.clientId);
      setMsgs(data);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 50);
      // Surface how the reply was delivered (in-app always; SMS for Basic+ when eligible).
      if (res?.sms?.sent) toast.success("Sent — also texted to the client");
      else if (res?.sms?.reason === "client_must_text_first") toast.success("Sent in-app — they'll get a text once they message you first");
    } catch { toast.error("Failed to send"); }
    finally { setSending(false); }
  }

  const unread = threads.filter((t) => t.fromClient && !t.read).length;

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-130px)] flex gap-4">

      {/* Thread list */}
      <div className="w-72 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Messages</h3>
          {unread > 0 && (
            <span className="text-xs font-bold text-white bg-violet-600 rounded-full px-2 py-0.5">{unread}</span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading ? <LoadingSpinner className="py-8" /> :
           threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <MessageSquare className="w-8 h-8 text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No messages yet</p>
              <p className="text-xs text-gray-300 mt-1">Clients can message from their portal</p>
            </div>
          ) : threads.map((t) => (
            <button key={t.clientId} onClick={() => openThread(t)}
              className={cn(
                "w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors",
                selected?.clientId === t.clientId && "bg-violet-50",
              )}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">
                    {t.client.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{t.client.name}</p>
                    <p className="text-xs text-gray-400 truncate">{t.lastMessage}</p>
                  </div>
                </div>
                {t.fromClient && !t.read && <div className="w-2 h-2 rounded-full bg-violet-600 shrink-0" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thread view */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MessageSquare className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">Select a conversation</p>
            <p className="text-xs text-gray-400 mt-1">Pick a client from the left to view messages</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm">
                {selected.client.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{selected.client.name}</p>
                <p className="text-xs text-gray-400">{selected.client.email}</p>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
              {msgs.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No messages yet</p>
              )}
              {msgs.map((m) => (
                <div key={m.id} className={cn("flex", m.fromClient ? "justify-start" : "justify-end")}>
                  <div className={cn(
                    "max-w-[72%] rounded-2xl px-4 py-2.5 text-sm",
                    m.fromClient
                      ? "bg-gray-100 text-gray-800 rounded-tl-sm"
                      : "bg-violet-600 text-white rounded-tr-sm",
                  )}>
                    <p>{m.content}</p>
                    <p className={cn("text-xs mt-1", m.fromClient ? "text-gray-400" : "text-violet-200")}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Compose */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-end gap-2">
              {plan === "FREE" ? (
                <div className="flex-1 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-sm text-gray-500">
                    🔒 Messaging is a paid-plan feature. Upgrade to <span className="font-semibold">Basic</span> or <span className="font-semibold">Pro</span> to reply to clients.
                  </p>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Type a reply…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={send} loading={sending} disabled={!reply.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
