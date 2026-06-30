"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CalendarClock, CheckCheck, CreditCard, Mail, MessageSquare, Search, ShieldCheck, Smartphone, FileText, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { api, DeviceToken, NotificationDelivery, NotificationItem, NotificationKind } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDashboardLocale } from "@/lib/dashboard-locale";

type Filter = "all" | "unread" | NotificationKind;
type View = "inbox" | "deliveries" | "templates" | "devices";
type DeliveryStatus = "ALL" | NotificationDelivery["status"];
type DeliveryChannel = "ALL" | NotificationDelivery["channel"];

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
  const { user } = useCurrentUser();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [logsLoading, setLogsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("inbox");
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>("ALL");
  const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>("ALL");
  const [deliverySearch, setDeliverySearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showClearHistory, setShowClearHistory] = useState(false);
  const [devices, setDevices] = useState<DeviceToken[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [preview, setPreview] = useState<{ title: string; desc: string; body: string } | null>(null);
  const { french } = useDashboardLocale();
  const [bizName, setBizName] = useState(french ? "votre entreprise" : "your business");
  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: french ? "Tous" : "All" },
    { id: "unread", label: french ? "Non lus" : "Unread" },
    { id: "BOOKING_NEW", label: french ? "Nouvelles réservations" : "New bookings" },
    { id: "BOOKING_UPDATE", label: french ? "Mises à jour" : "Booking updates" },
    { id: "PAYMENT", label: french ? "Paiements" : "Payments" },
    { id: "SYSTEM", label: french ? "Système" : "System" },
  ];

  useEffect(() => {
    if (user?.businessId) api.business.get(user.businessId).then((b) => setBizName(b.name)).catch(() => {});
  }, [user?.businessId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(deliverySearch), 300);
    return () => clearTimeout(t);
  }, [deliverySearch]);

  // Fill the {{tokens}} with realistic sample data so the owner sees exactly what
  // a client receives.
  const sample: Record<string, string> = {
    client: "Jamie Rivera",
    service: "Full groom",
    business: bizName,
    staff: bizName,
    time: "Sat, Jun 14 at 2:30 PM",
    reason: french ? "Nous sommes désolés pour le désagrément." : "We're sorry for the inconvenience.",
  };
  const renderTemplate = (body: string) => body.replace(/\{\{(\w+)\}\}/g, (_, k) => sample[k] ?? `{{${k}}}`);

  const load = useCallback(async () => {
    setLoadError(""); setLoading(true);
    try { setItems(await api.notifications.list()); }
    catch (e) { setLoadError(e instanceof Error ? e.message : (french ? "Échec du chargement des notifications" : "Failed to load notifications")); }
    finally { setLoading(false); }
  }, [french]);

  const loadDeliveries = useCallback(async () => {
    setLogsLoading(true);
    try {
      setDeliveries(await api.notifications.deliveries({
        status: deliveryStatus,
        channel: deliveryChannel,
        search: debouncedSearch,
        limit: 100,
      }));
    }
    catch { /* delivery log errors are non-critical; silently reset to empty */ setDeliveries([]); }
    finally { setLogsLoading(false); }
  }, [deliveryChannel, debouncedSearch, deliveryStatus]);

  useEffect(() => { load(); loadDeliveries(); }, [load, loadDeliveries]);

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true);
    try { setDevices(await api.devices.list()); }
    catch { setDevices([]); }
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

  async function clearHistory() {
    try {
      await api.notifications.clear();
      setItems([]);
      toast.success(french ? "Historique des notifications effacé" : "Notification history cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (french ? "Impossible d’effacer l’historique des notifications" : "Could not clear notification history"));
    }
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
      <ConfirmDialog
        open={showClearHistory}
        title={french ? "Effacer l’historique des notifications?" : "Clear notification history?"}
        description={french ? "Toutes les notifications seront supprimées définitivement. Cette action est irréversible." : "All notifications will be permanently removed. This cannot be undone."}
        confirmLabel={french ? "Effacer l’historique" : "Clear history"}
        variant="destructive"
        onConfirm={() => { setShowClearHistory(false); clearHistory(); }}
        onCancel={() => setShowClearHistory(false)}
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{french ? "Notifications" : "Notifications"}</h2>
          <p className="text-sm text-gray-500">
            {unread > 0 ? `${unread} ${french ? "non lues" : "unread"}` : (french ? "Boîte de réception vide" : "Inbox is clear")} · {failedDeliveries} {french ? "échec de livraison" : "failed delivery"}{failedDeliveries === 1 ? "" : french ? "s" : "ies"}
          </p>
        </div>
        <div className="flex gap-2">
          {unread > 0 && <Button variant="outline" size="sm" onClick={markAll}><CheckCheck className="w-4 h-4 mr-1.5" /> {french ? "Tout marquer comme lu" : "Mark all read"}</Button>}
          {items.length > 0 && <Button variant="outline" size="sm" className="text-xs px-2 py-1 h-7" onClick={() => setShowClearHistory(true)}><Trash2 className="w-4 h-4 mr-1.5" /> {french ? "Effacer l’historique" : "Clear history"}</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-gray-100 bg-white p-1 shadow-sm">
          {(["inbox", "deliveries", "templates", "devices"] as const).map((id) => (
            <button key={id} onClick={() => setView(id)}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                view === id ? "bg-violet-600 text-white" : "text-gray-500 hover:bg-gray-50")}>
              {french
                ? (id === "inbox" ? "Boîte de réception" : id === "deliveries" ? "Journaux d’envoi" : id === "templates" ? "Modèles" : "Appareils")
                : (id === "inbox" ? "Inbox" : id === "deliveries" ? "Delivery logs" : id === "templates" ? "Templates" : "Devices")}
            </button>
          ))}
        </div>

        {view === "inbox" && (
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
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
            {french ? "Actualiser" : "Refresh"}
          </Button>
        )}
      </div>

      {view === "inbox" ? (
        loading ? <LoadingSpinner /> : loadError ? (
          <div className="text-center py-16">
            <p className="text-red-500 mb-3">{loadError}</p>
            <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">{french ? "Réessayer" : "Retry"}</button>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState title={french ? "Aucune notification correspondante" : "No matching notifications"} description={french ? "Les nouvelles réservations, les paiements et les mises à jour système apparaîtront ici." : "New bookings, payments, and system updates will show here."} />
        ) : (
          <div className="space-y-2">
            {visible.map((n) => {
              const Icon = iconFor(n.kind);
              const urgentMessage = n.title.startsWith("Urgent:");
              return (
                <button key={n.id} onClick={() => open(n)}
                  className={cn("w-full text-left rounded-xl border p-4 transition-colors",
                    urgentMessage && !n.read ? "border-red-200 bg-red-50 shadow-sm hover:bg-red-100/60" :
                    n.read ? "border-gray-100 bg-white hover:bg-gray-50" : "border-violet-200 bg-white shadow-sm hover:bg-violet-50/40")}>
                  <div className="flex items-start gap-3">
                    <div className={cn("w-9 h-9 rounded-lg border flex items-center justify-center shrink-0", urgentMessage && !n.read ? "border-red-200 bg-red-100 text-red-700" : colorFor(n.kind, n.read))}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm truncate", urgentMessage && !n.read ? "font-bold text-red-900" : n.read ? "font-medium text-gray-700" : "font-semibold text-gray-900")}>{n.title}</p>
                        {!n.read && <span className={cn("w-2 h-2 rounded-full shrink-0", urgentMessage ? "bg-red-600" : "bg-violet-500")} />}
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
                  placeholder={french ? "Rechercher un destinataire, un type ou une erreur" : "Search recipient, type, or error"}
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
          <EmptyState title={french ? "Aucun journal d’envoi" : "No delivery logs found"} description={french ? "Les tentatives par courriel, SMS et notification poussée correspondant à ces filtres apparaîtront ici." : "Email, SMS, and push attempts matching these filters will appear here."} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="hidden grid-cols-[1.1fr_1fr_1fr_auto] gap-3 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 md:grid">
                <span>{french ? "Type" : "Type"}</span><span>{french ? "Destinataire" : "Recipient"}</span><span>{french ? "Quand" : "When"}</span><span>{french ? "État" : "Status"}</span>
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
                          onClick={() => toast.info(d.retryReason ?? (french ? "La nouvelle tentative n’est pas disponible pour cet envoi." : "Retry is not available for this delivery."))}
                        >
                          {french ? "Nouvelle tentative indisponible" : "Retry unavailable"}
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
            [french ? "Confirmation de réservation" : "Booking confirmation", french ? "Envoyé lorsqu’un rendez-vous est confirmé." : "Sent when an appointment is confirmed.", french ? "Bonjour {{client}}, votre rendez-vous {{service}} chez {{business}} est confirmé pour {{time}}." : "Hi {{client}}, your {{service}} appointment at {{business}} is confirmed for {{time}}."],
            [french ? "Demande en attente" : "Pending request", french ? "Envoyé lorsqu’une approbation est requise." : "Sent when approval is required.", french ? "Nous avons reçu votre demande de réservation et vous aviserons une fois que {{business}} l’aura approuvée." : "We received your booking request and will notify you once {{business}} approves it."],
            [french ? "Rappel" : "Reminder", french ? "Envoyé avant les rendez-vous à venir." : "Sent before upcoming appointments.", french ? "Rappel : le rendez-vous {{service}} avec {{staff}} approche à {{time}}." : "Reminder: {{service}} with {{staff}} is coming up at {{time}}."],
            [french ? "Annulation" : "Cancellation", french ? "Envoyé lorsqu’un rendez-vous est annulé." : "Sent when an appointment is cancelled.", french ? "Votre rendez-vous pour {{service}} a été annulé. {{reason}}" : "Your appointment for {{service}} has been cancelled. {{reason}}"],
            [french ? "Replanification" : "Reschedule", french ? "Envoyé lorsqu’une heure de réservation change." : "Sent when a booking time changes.", french ? "Votre rendez-vous {{service}} a été déplacé à {{time}}." : "Your {{service}} appointment has moved to {{time}}."],
            [french ? "Demande d’avis" : "Review request", french ? "Envoyé après les rendez-vous terminés." : "Sent after completed appointments.", french ? "Merci de votre visite chez {{business}}. Comment s’est passé votre rendez-vous ?" : "Thanks for visiting {{business}}. How was your appointment?"],
          ].map(([title, desc, body]) => (
            <div key={title} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-500" />
                <p className="text-sm font-semibold text-gray-900">{title}</p>
              </div>
              <p className="mt-1 text-xs text-gray-400">{desc}</p>
              <p className="mt-3 rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">{body}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setPreview({ title, desc, body })}>
                {french ? "Aperçu du modèle" : "Preview template"}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">{french ? "Appareils de notification poussée" : "Push devices"}</h3>
            <p className="text-xs text-gray-400">{french ? "Appareils inscrits depuis l’application mobile pour votre compte." : "Devices registered from the mobile app for your account."}</p>
          </div>
          {devicesLoading ? <LoadingSpinner /> : devices.length === 0 ? (
            <EmptyState title={french ? "Aucun appareil poussé inscrit" : "No registered push devices"} description={french ? "Connectez-vous à l’application mobile et autorisez les notifications pour enregistrer un appareil." : "Sign in to the mobile app and allow notifications to register a device."} />
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
                      <p className="text-xs text-gray-400">{french ? "Mis à jour" : "Updated"} {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}</p>
                    </div>
                  </div>
                  <Button size="sm" variant={d.enabled ? "outline" : "secondary"} onClick={async () => {
                    try {
                      await api.devices.setEnabled(d.id, !d.enabled);
                      setDevices((prev) => prev.map((x) => x.id === d.id ? { ...x, enabled: !x.enabled } : x));
                    } catch { toast.error(french ? "Échec de la mise à jour de l’appareil" : "Failed to update device"); }
                  }}>
                    {d.enabled ? (french ? "Désactiver" : "Disable") : (french ? "Activer" : "Enable")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Template preview — shows the message rendered with realistic data */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={() => setPreview(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-500" />
                <p id="template-preview-title" className="text-sm font-semibold text-gray-900">{preview.title}</p>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{preview.desc}</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{french ? "Aperçu — ce que le client voit" : "Preview — what the client sees"}</p>
                {/* Email-style preview card */}
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="bg-[#E9A23C] px-4 py-2.5"><p className="text-white text-sm font-bold">{bizName}</p></div>
                  <div className="p-4 bg-white">
                    <p className="text-sm text-gray-700 leading-relaxed">{renderTemplate(preview.body)}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{french ? "Modèle" : "Template"}</p>
                <p className="rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600 font-mono">{preview.body}</p>
                <p className="text-[11px] text-gray-400 mt-1.5">{french ? <>Les jetons comme <code className="text-violet-600">{"{{client}}"}</code> sont remplis automatiquement à l’envoi. La modification personnalisée arrive bientôt.</> : <>Tokens like <code className="text-violet-600">{"{{client}}"}</code> are filled in automatically when sent. Custom editing is coming soon.</>}</p>
              </div>
              <Button className="w-full" onClick={() => setPreview(null)}>{french ? "Fermer" : "Close"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
