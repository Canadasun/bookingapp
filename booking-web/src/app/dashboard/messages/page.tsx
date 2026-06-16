"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Send, MessageSquare, ChevronLeft, Mail, Smartphone, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import { useEvents } from "@/lib/hooks";

interface Thread { clientId: string; client: { id: string; name: string; email?: string | null }; lastMessage: string; fromClient: boolean; read: boolean; unreadCount: number; archived?: boolean; createdAt: string }
interface Message { id: string; content: string; fromClient: boolean; read: boolean; createdAt: string }

export default function MessagesPage() {
  const [threads, setThreads]   = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [msgs, setMsgs]         = useState<Message[]>([]);
  const [reply, setReply]       = useState("");
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState("");
  const [threadError, setThreadError] = useState("");
  const [filter, setFilter]     = useState<"all" | "unread" | "archived">("all");
  const [channel, setChannel]   = useState<"ALL" | "IN_APP" | "SMS">("ALL");
  const [search, setSearch]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const user = getUser();
  const bizId = user?.businessId ?? "";

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadThreads = useCallback(async () => {
    if (!bizId) {
      setLoading(false);
      return;
    }
    setLoadError("");
    try {
      const threadData = await api.messages.threads(bizId, { unread: filter === "unread", archived: filter === "archived", search: debouncedSearch.trim() || undefined, channel: channel !== "ALL" ? channel : undefined });
      setThreads(threadData);
    }
    catch (e) { setLoadError(e instanceof Error ? e.message : "Failed to load messages"); }
    finally { setLoading(false); }
  }, [bizId, filter, channel, debouncedSearch]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  useEvents(bizId || null, useCallback(() => {
    loadThreads();
    if (selected && bizId) {
      api.messages.thread(bizId, selected.clientId).then(setMsgs).catch(() => {});
    }
  }, [bizId, loadThreads, selected]));

  async function openThread(t: Thread) {
    if (!bizId) return;
    setSelected(t);
    setThreadError("");
    try {
      const data = await api.messages.thread(bizId, t.clientId);
      setMsgs(data);
      await api.messages.markRead(bizId, t.clientId);
      setThreads((prev) => prev.map((thread) => thread.clientId === t.clientId ? { ...thread, read:true, unreadCount:0 } : thread));
      loadThreads();
    } catch (e) { setThreadError(e instanceof Error ? e.message : "Failed to load thread"); }
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 80);
  }

  async function send() {
    if (!reply.trim() || !selected || !bizId) return;
    setSending(true);
    try {
      const res = await api.messages.reply(bizId, selected.clientId, reply.trim());
      setReply("");
      const data = await api.messages.thread(bizId, selected.clientId);
      setMsgs(data);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
      // Surface how the reply was delivered (in-app always; SMS for Basic+ when eligible).
      if (res?.sms?.sent) toast.success("Sent and texted to the client");
      else if (res?.sms?.reason === "client_must_text_first") toast.success("Sent in-app. SMS is available after the client texts first.");
      else if (res?.sms?.reason === "send_failed") toast.warning("Sent in-app, but the SMS could not be delivered.");
      else if (res?.sms?.reason === "no_phone") toast.success("Sent in-app. This client has no phone number for SMS.");
      else if (res?.sms?.reason === "plan_not_eligible") toast.success("Sent in-app.");
      loadThreads();
    } catch { toast.error("Failed to send"); }
    finally { setSending(false); }
  }

  const unread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  async function setSelectedArchived(archived: boolean) {
    if (!selected || !bizId) return;
    try {
      await api.messages.archive(bizId, selected.clientId, archived);
      setSelected(null); setMsgs([]); loadThreads();
      toast.success(archived ? "Conversation archived" : "Conversation restored");
    } catch { toast.error("Failed to update conversation"); }
  }

  return (
    <div className="dashboard-dynamic-height max-w-5xl mx-auto flex min-h-[28rem] gap-4">

      {/* Thread list — full-width on mobile; hidden there once a thread is open */}
      <div className={cn(
        "w-full md:w-72 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex-col overflow-hidden",
        selected ? "hidden md:flex" : "flex",
      )}>
        <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Conversations</h3>
          {unread > 0 && (
            <span className="text-xs font-bold text-white bg-violet-600 rounded-full px-2 py-0.5">{unread}</span>
          )}
        </div>
        <div className="p-3 border-b border-gray-100 space-y-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages" />
          <div className="flex gap-1">
            {(["all", "unread", "archived"] as const).map((value) => <button key={value} onClick={() => setFilter(value)} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold capitalize", filter === value ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-500")}>{value}</button>)}
          </div>
          <div className="flex gap-1">
            {([
              { val: "ALL", icon: null, label: "All" },
              { val: "IN_APP", icon: <Mail className="w-3 h-3" />, label: "In-app" },
              { val: "SMS", icon: <MessageCircle className="w-3 h-3" />, label: "SMS" },
            ] as const).map(({ val, icon, label }) => (
              <button key={val} onClick={() => setChannel(val)}
                className={cn("rounded-full px-2.5 py-1 text-xs font-semibold flex items-center gap-1", channel === val ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-500")}>
                {icon}{label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loadError ? (
            <div className="text-center py-10 px-4">
              <p className="text-red-500 text-sm mb-3">{loadError}</p>
              <button onClick={() => { setLoadError(""); loadThreads(); }} className="text-violet-600 hover:underline text-sm">Retry</button>
            </div>
          ) : loading ? <LoadingSpinner className="py-8" /> :
           threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <MessageSquare className="w-8 h-8 text-gray-200 mb-2" aria-hidden="true" />
              <p className="text-sm text-gray-400">No messages yet</p>
              <p className="text-xs text-gray-600 mt-1">Clients can message from their portal</p>
            </div>
          ) : threads.map((t) => (
            <button key={t.clientId} onClick={() => openThread(t)}
              className={cn(
                "w-full px-4 py-3 text-left transition-colors",
                t.unreadCount > 0 ? "bg-red-50 hover:bg-red-100/70" : "hover:bg-gray-50",
                selected?.clientId === t.clientId && "ring-1 ring-inset ring-violet-200",
              )}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">
                    {t.client.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm truncate", t.unreadCount > 0 ? "font-bold text-red-900" : "font-semibold text-gray-800")}>{t.client.name}</p>
                      {t.unreadCount > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">{t.unreadCount} unread</span>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{t.lastMessage}</p>
                  </div>
                </div>
                {t.unreadCount > 0 && <div className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0 shadow-sm shadow-red-300" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thread view — full-width on mobile; hidden there until a thread is open */}
      <div className={cn(
        "flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex-col overflow-hidden",
        selected ? "flex" : "hidden md:flex",
      )}>
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MessageSquare className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">Select a conversation</p>
            <p className="text-xs text-gray-400 mt-1">Pick a client from the left to view messages</p>
          </div>
        ) : (
          <>
            {/* Header — the back arrow returns to the list on mobile */}
            <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center gap-2 sm:gap-3">
              <button onClick={() => setSelected(null)}
                className="md:hidden -ml-1 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors" aria-label="Back to conversations">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0">
                {selected.client.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{selected.client.name}</p>
                <p className="text-xs text-gray-400 truncate">{selected.client.email || "Phone contact"}</p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-2 py-1 shrink-0">
                <Mail className="w-3 h-3" /> In-app · <Smartphone className="w-3 h-3" /> SMS
              </span>
              <button onClick={() => setSelectedArchived(!selected.archived)} aria-label={selected.archived ? "Restore conversation" : "Archive conversation"} className="text-xs font-semibold text-gray-500 hover:text-red-600">
                {selected.archived ? "Restore" : "Archive"}
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
              {threadError && (
                <div className="text-center py-8">
                  <p className="text-red-500 text-sm mb-3">{threadError}</p>
                  <button onClick={() => { setThreadError(""); if (selected) openThread(selected); }} className="text-violet-600 hover:underline text-sm">Retry</button>
                </div>
              )}
              {!threadError && msgs.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No messages yet</p>
              )}
              {msgs.map((m) => (
                <div key={m.id} className={cn("flex", m.fromClient ? "justify-start" : "justify-end")}>
                  <div className={cn(
                    "max-w-[88%] sm:max-w-[72%] rounded-2xl px-4 py-2.5 text-sm break-words [overflow-wrap:anywhere]",
                    m.fromClient
                      ? "bg-gray-100 text-gray-800 rounded-tl-sm"
                      : "bg-violet-600 text-white rounded-tr-sm",
                  )}>
                    <p>{m.content}</p>
                    <p className={cn("text-xs mt-1", m.fromClient ? "text-gray-400" : "text-violet-200")}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Compose */}
            <div className="dashboard-safe-bottom px-3 sm:px-4 py-3 border-t border-gray-100 flex items-end gap-2">
              <Input
                placeholder="Type a reply…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                className="flex-1"
              />
              <Button size="sm" onClick={send} loading={sending} disabled={!reply.trim()} aria-label="Send message">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
