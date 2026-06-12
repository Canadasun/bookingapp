"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  fromClient: boolean;
  createdAt: string;
}

interface ClientMessagingProps {
  businessId: string;
  clientId: string;
  businessName: string;
  appointmentId?: string;
  token?: string;
}

export function ClientMessaging({ businessId, clientId, businessName, appointmentId, token }: ClientMessagingProps) {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.messages.thread(businessId, clientId, appointmentId, token);
      setMsgs(data);
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, clientId, appointmentId, token]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [msgs]);

  async function send() {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      await api.messages.send(businessId, clientId, content.trim(), appointmentId, token);
      setContent("");
      await load();
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[400px] bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-violet-600" />
        <h3 className="text-sm font-semibold text-gray-900">Message {businessName}</h3>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && msgs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
        ) : msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-sm text-gray-500">No messages yet.</p>
            <p className="text-xs text-gray-400 mt-1">Send a message to the business if you have questions about your appointment.</p>
          </div>
        ) : (
          msgs.map((m) => (
            <div key={m.id} className={cn("flex", m.fromClient ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
                m.fromClient
                  ? "bg-violet-600 text-white rounded-tr-sm"
                  : "bg-gray-100 text-gray-800 rounded-tl-sm",
              )}>
                <p>{m.content}</p>
                <p className={cn("text-[10px] mt-1", m.fromClient ? "text-violet-200" : "text-gray-400")}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-gray-100 flex gap-2">
        <Input
          placeholder="Type a message..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          className="flex-1 h-9 text-sm"
        />
        <Button size="sm" onClick={send} disabled={!content.trim() || sending} className="h-9 w-9 p-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
