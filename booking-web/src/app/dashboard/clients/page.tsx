"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Plus, Phone, Mail, Calendar, DollarSign, X, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api, ClientPackage, Payment, ClientWithStats } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList, SkeletonCard } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { formatPrice } from "@/lib/utils";

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<(ClientWithStats & { appointments?: unknown[]; payments?: Payment[]; packages?: ClientPackage[]; messages?: Array<{ id: string; content: string; fromClient: boolean; createdAt: string }> }) | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [deletingClient, setDeletingClient] = useState(false);

  const user = getUser();
  const bizId = user?.businessId ?? "";

  const load = useCallback(async (q?: string, pg = 1, append = false) => {
    if (!bizId) {
      setLoading(false);
      return;
    }
    if (!append) setLoading(true); else setLoadingMore(true);
    try {
      const res = await api.clients.list(bizId, q, pg);
      setClients((prev) => append ? [...prev, ...res.data] : res.data);
      setPage(res.page);
      setTotalPages(res.pages);
      setTotal(res.total);
    }
    catch { toast.error("Failed to load clients"); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(search, 1); }, 300);
    return () => clearTimeout(t);
  }, [search, load]);

  async function openClient(c: ClientWithStats) {
    if (!bizId) return;
    setSelected(c);
    setLoadingDetail(true);
    try {
      const [detail, payments, packages, messages] = await Promise.all([
        api.clients.get(bizId, c.id),
        api.payments.list().then((rows) => rows.filter((p) => p.client?.id === c.id)).catch(() => []),
        api.packages.listIssued(bizId, c.id).catch(() => []),
        api.messages.thread(bizId, c.id).catch(() => []),
      ]);
      setSelected({ ...c, ...detail, payments, packages, messages });
    } catch { toast.error("Failed to load client details"); }
    finally { setLoadingDetail(false); }
  }

  async function addClient() {
    if (!form.name || !form.email) { toast.error("Name and email required"); return; }
    if (!bizId) return;
    setSaving(true);
    try {
      await api.clients.create(bizId, form);
      toast.success("Client added");
      setShowAdd(false);
      setForm({ name: "", email: "", phone: "", notes: "" });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function deleteClient() {
    if (!bizId || !selected) return;
    const ok = window.confirm(
      `Delete ${selected.name}? This removes the client profile and appointment history from the log. Payments remain in reporting.`,
    );
    if (!ok) return;
    setDeletingClient(true);
    try {
      const res = await api.clients.delete(bizId, selected.id);
      toast.success(res.deletedAppointments > 0
        ? `Client deleted with ${res.deletedAppointments} appointment${res.deletedAppointments === 1 ? "" : "s"}`
        : "Client deleted");
      setSelected(null);
      await load(search, 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete client");
    } finally {
      setDeletingClient(false);
    }
  }

  const detail = selected as (ClientWithStats & {
    appointments?: Array<{ id: string; startsAt: string; status: string; service: { name: string }; staff: { user: { name: string } } }>;
    payments?: Payment[];
    packages?: ClientPackage[];
    messages?: Array<{ id: string; content: string; fromClient: boolean; createdAt: string }>;
  }) | null;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Clients</h2>
          <p className="text-sm text-gray-500">{total} client{total !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5"><Plus className="w-4 h-4" />Add client</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search by name, email, or phone…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? <SkeletonList rows={8} /> : clients.length === 0 ? (
        <EmptyState title="No clients found" description="Add your first client or adjust the search." />
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openClient(c)}>
              <CardContent className="py-3 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-sm shrink-0">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>
                    {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500 shrink-0 hidden sm:block">
                  <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />{c.totalVisits} visits</div>
                  {c.lastVisit && <div className="mt-0.5">Last: {format(new Date(c.lastVisit), "MMM d")}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Load more */}
      {page < totalPages && !loading && (
        <div className="mt-4 text-center">
          <button
            onClick={() => load(search, page + 1, true)}
            disabled={loadingMore}
            className="px-5 py-2 text-sm font-medium text-violet-700 border border-violet-200 rounded-xl hover:bg-violet-50 disabled:opacity-50 transition-colors">
            {loadingMore ? "Loading…" : `Load more (${total - clients.length} remaining)`}
          </button>
        </div>
      )}

      {/* Client detail drawer */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSelected(null)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={deleteClient}
                  loading={deletingClient}
                  className="gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />Delete
                </Button>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-gray-600"><Mail className="w-4 h-4 text-gray-400" />{selected.email}</div>
                {selected.phone && <div className="flex items-center gap-2 text-gray-600"><Phone className="w-4 h-4 text-gray-400" />{selected.phone}</div>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total visits", value: selected.totalVisits, icon: Calendar },
                  { label: "Total spent",  value: formatPrice(selected.totalSpentCents ?? 0), icon: DollarSign },
                  { label: "Member since", value: format(new Date(selected.createdAt), "MMM yyyy"), icon: Calendar },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-base font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              {selected.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{selected.notes}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Appointment history</p>
                {loadingDetail ? <div className="space-y-2 py-2"><SkeletonCard /><SkeletonCard /></div> :
                  (detail?.appointments?.length ?? 0) === 0 ? <p className="text-sm text-gray-400">No appointments yet.</p> : (
                  <div className="space-y-2">
                    {(detail?.appointments ?? []).map((apt) => (
                      <div key={apt.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{apt.service.name}</p>
                          <p className="text-xs text-gray-500">{format(new Date(apt.startsAt), "MMM d, yyyy")} · {apt.staff.user.name}</p>
                        </div>
                        <StatusBadge status={apt.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Payments</p>
                {(detail?.payments?.length ?? 0) === 0 ? <p className="text-sm text-gray-400">No payments recorded.</p> : (
                  <div className="space-y-2">
                    {(detail?.payments ?? []).slice(0, 8).map((p) => (
                      <div key={p.id} className="flex items-center justify-between border-b border-gray-100 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{formatPrice(p.amountCents - p.refundedCents)}</p>
                          <p className="text-xs text-gray-500">{p.kind.replaceAll("_", " ")} · {format(new Date(p.createdAt), "MMM d, yyyy")}</p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{p.status.replaceAll("_", " ")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Packages</p>
                {(detail?.packages?.length ?? 0) === 0 ? <p className="text-sm text-gray-400">No active packages.</p> : (
                  <div className="space-y-2">
                    {(detail?.packages ?? []).slice(0, 6).map((pkg) => (
                      <div key={pkg.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{pkg.name}</p>
                          <p className="text-xs text-gray-500">{pkg.creditsRemaining} of {pkg.creditsTotal} credits left</p>
                        </div>
                        <span className="text-xs font-semibold text-gray-600">{pkg.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent messages</p>
                {(detail?.messages?.length ?? 0) === 0 ? <p className="text-sm text-gray-400">No messages yet.</p> : (
                  <div className="space-y-2">
                    {(detail?.messages ?? []).slice(-5).reverse().map((m) => (
                      <div key={m.id} className="rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-xs font-semibold text-gray-500">{m.fromClient ? "Client" : "Business"} · {format(new Date(m.createdAt), "MMM d")}</p>
                        <p className="mt-1 text-sm text-gray-700 line-clamp-2">{m.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add client modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <Card className="relative w-full max-w-sm z-10">
            <CardHeader><CardTitle>Add client</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { k:"name",  label:"Full name *",   type:"text",  ph:"Jane Doe" },
                { k:"email", label:"Email *",        type:"email", ph:"jane@example.com" },
                { k:"phone", label:"Phone",          type:"tel",   ph:"+1 555 000 0000" },
                { k:"notes", label:"Notes",          type:"text",  ph:"Any notes…" },
              ].map(({ k, label, type, ph }) => (
                <div key={k}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <Input type={type} placeholder={ph} value={form[k as keyof typeof form]}
                    onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button className="flex-1" loading={saving} onClick={addClient}>Add</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
