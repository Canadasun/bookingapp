"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CalendarClock, CheckCheck, CreditCard, Mail, MessageSquare, Search, ShieldCheck, Smartphone, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { api, DeviceToken, NotificationDelivery, NotificationItem, NotificationKind } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";

type Filter = "all" | "unread" | NotificationKind;
type View = "inbox" | "deliveries" | "templates" | "devices";
type DeliveryStatus = "ALL" | NotificationDelivery["status"];
type DeliveryChannel = "ALL" | NotificationDelivery["channel"];

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "BOOKING_NEW", label: "New bookings" },
  { id: "BOOKING_UPDATE", label: "Booking updates" },
  { id: "PAYMENT", label: "Payments" },
  { id: "SYSTEM", label: "System" },
];

function iconFor(kind: NotificationKind) {
  if (kind === "BOOKING_NEW") return CalendarClock;
  if (kind === "BOOKING_UPDATE") return MessageSquare;
  if (kind === "PAYMENT") return CreditCard;
  return ShieldCheck;
}

function colorFor(kind: NotificationKind, read: boolean) {
  if (read) return "bg-gray-100 text-gray-400 border-gray-100";
  if (kind === "PAYMENT") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (kind === "SYSTEM") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-violet-50 text-violet-700 border-violet-200";
}

function statusColor(status: NotificationDelivery["status"]) {
  if (status === "SENT") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "FAILED") return "bg-red-50 text-red-700 border-red-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("inbox");
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>("ALL");
  const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>("ALL");
  const [deliverySearch, setDeliverySearch] = useState("");
  const [devices, setDevices] = useState<DeviceToken[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await api.notifications.list()); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load notifications"); }
    finally { setLoading(false); }
  }, []);

  const loadDeliveries = useCallback(async () => {
    setLogsLoading(true);
    try {
      setDeliveries(await api.notifications.deliveries({
        status: deliveryStatus,
        channel: deliveryChannel,
        search: deliverySearch,
        limit: 100,
      }));
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load delivery logs"); }
    finally { setLogsLoading(false); }
  }, [deliveryChannel, deliverySearch, deliveryStatus]);

  useEffect(() => { load(); loadDeliveries(); }, [load, loadDeliveries]);

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true);
    try { setDevices(await api.devices.list()); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load devices"); }
    finally { setDevicesLoading(false); }
  }, []);

  useEffect(() => { if (view === "devices") loadDevices(); }, [view, loadDevices]);

  function open(n: NotificationItem) {
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
  const failedDeliveries = deliveries.filter((d) => d.status === "FAILED").length;
  const visible = items.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read;
    return n.kind === filter;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
          <p className="text-sm text-gray-500">
            {unread > 0 ? `${unread} unread` : "Inbox is clear"} · {failedDeliveries} failed delivery{failedDeliveries === 1 ? "" : "ies"}
          </p>
        </div>
        {unread > 0 && <Button variant="outline" size="sm" onClick={markAll}><CheckCheck className="w-4 h-4 mr-1.5" /> Mark all read</Button>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-gray-100 bg-white p-1 shadow-sm">
          {(["inbox", "deliveries", "templates", "devices"] as const).map((id) => (
            <button key={id} onClick={() => setView(id)}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                view === id ? "bg-violet-600 text-white" : "text-gray-500 hover:bg-gray-50")}>
              {id === "inbox" ? "Inbox" : id === "deliveries" ? "Delivery logs" : id === "templates" ? "Templates" : "Devices"}
            </button>
          ))}
        </div>

        {view === "inbox" && (
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  filter === f.id ? "border-violet-200 bg-violet-50 text-violet-700" : "border-gray-100 bg-white text-gray-500 hover:bg-gray-50")}>
                {f.label}
              </button>
            ))}
          </div>
        )}

        {view === "deliveries" && (
          <Button variant="outline" size="sm" onClick={loadDeliveries} disabled={logsLoading}>
            Refresh
          </Button>
        )}
      </div>

      {view === "inbox" ? (
        loading ? <LoadingSpinner /> : visible.length === 0 ? (
          <EmptyState title="No matching notifications" description="New bookings, payments, and system updates will show here." />
        ) : (
          <div className="space-y-2">
            {visible.map((n) => {
              const Icon = iconFor(n.kind);
              return (
                <button key={n.id} onClick={() => open(n)}
                  className={cn("w-full text-left rounded-xl border p-4 transition-colors",
                    n.read ? "border-gray-100 bg-white hover:bg-gray-50" : "border-violet-200 bg-white shadow-sm hover:bg-violet-50/40")}>
                  <div className="flex items-start gap-3">
                    <div className={cn("w-9 h-9 rounded-lg border flex items-center justify-center shrink-0", colorFor(n.kind, n.read))}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm truncate", n.read ? "font-medium text-gray-700" : "font-semibold text-gray-900")}>{n.title}</p>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />}
                      </div>
                      {n.body && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{n.body}</p>}
                      <p className="text-xs text-gray-400 mt-1.5">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : view === "deliveries" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={deliverySearch}
                  onChange={(e) => setDeliverySearch(e.target.value)}
                  placeholder="Search recipient, type, or error"
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1 rounded-lg bg-gray-50 p-1">
                {(["ALL", "SENT", "FAILED", "SKIPPED"] as const).map((status) => (
                  <button key={status} onClick={() => setDeliveryStatus(status)}
                    className={cn("rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                      deliveryStatus === status ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800")}>
                    {status}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 rounded-lg bg-gray-50 p-1">
                {(["ALL", "EMAIL", "SMS", "PUSH"] as const).map((channel) => (
                  <button key={channel} onClick={() => setDeliveryChannel(channel)}
                    className={cn("rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                      deliveryChannel === channel ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800")}>
                    {channel}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {logsLoading ? <LoadingSpinner /> : deliveries.length === 0 ? (
            <EmptyState title="No delivery logs found" description="Email, SMS, and push attempts matching these filters will appear here." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="hidden grid-cols-[1.1fr_1fr_1fr_auto] gap-3 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 md:grid">
                <span>Type</span><span>Recipient</span><span>When</span><span>Status</span>
              </div>
              <div className="divide-y divide-gray-50">
                {deliveries.map((d) => (
                  <div key={d.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1.1fr_1fr_1fr_auto] md:items-start">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {d.channel === "EMAIL" ? <Mail className="h-4 w-4 text-gray-400" /> : <Bell className="h-4 w-4 text-gray-400" />}
                        <p className="truncate text-sm font-medium text-gray-800">{d.type}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">{d.channel}</p>
                    </div>
                    <p className="truncate text-sm text-gray-600">{d.recipient}</p>
                    <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}</p>
                    <div className="text-left md:text-right">
                      <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", statusColor(d.status))}>{d.status}</span>
                      {d.error && (
                        <p className="mt-1 max-w-72 text-xs text-red-500 md:max-w-56">
                          <AlertTriangle className="mr-1 inline h-3 w-3" />{d.error}
                        </p>
                      )}
                      {d.status === "FAILED" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-7 px-2 text-xs text-gray-500"
                          onClick={() => toast.info(d.retryReason ?? "Retry is not available for this delivery.")}
                        >
                          Retry unavailable
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : view === "templates" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["Booking confirmation", "Sent when an appointment is confirmed.", "Hi {{client}}, your {{service}} appointment at {{business}} is confirmed for {{time}}."],
            ["Pending request", "Sent when approval is required.", "We received your booking request and will notify you once {{business}} approves it."],
            ["Reminder", "Sent before upcoming appointments.", "Reminder: {{service}} with {{staff}} is coming up at {{time}}."],
            ["Cancellation", "Sent when an appointment is cancelled.", "Your appointment for {{service}} has been cancelled. {{reason}}"],
            ["Reschedule", "Sent when a booking time changes.", "Your {{service}} appointment has moved to {{time}}."],
            ["Review request", "Sent after completed appointments.", "Thanks for visiting {{business}}. How was your appointment?"],
          ].map(([title, desc, body]) => (
            <div key={title} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-500" />
                <p className="text-sm font-semibold text-gray-900">{title}</p>
              </div>
              <p className="mt-1 text-xs text-gray-400">{desc}</p>
              <p className="mt-3 rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">{body}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => toast.info("Template editing will save to business notification settings in the next backend migration.")}>
                Preview template
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Push devices</h3>
            <p className="text-xs text-gray-400">Devices registered from the mobile app for your account.</p>
          </div>
          {devicesLoading ? <LoadingSpinner /> : devices.length === 0 ? (
            <EmptyState title="No registered push devices" description="Sign in to the mobile app and allow notifications to register a device." />
          ) : (
            <div className="divide-y divide-gray-50">
              {devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{d.platform}</p>
                      <p className="text-xs text-gray-400">Updated {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}</p>
                    </div>
                  </div>
                  <Button size="sm" variant={d.enabled ? "outline" : "secondary"} onClick={async () => {
                    await api.devices.setEnabled(d.id, !d.enabled);
                    setDevices((prev) => prev.map((x) => x.id === d.id ? { ...x, enabled: !x.enabled } : x));
                  }}>
                    {d.enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
