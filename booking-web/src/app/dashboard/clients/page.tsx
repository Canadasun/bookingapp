"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Phone, Mail, Calendar, DollarSign, X, Trash2, Pencil, CalendarPlus, GitMerge, Download, Upload, Ban, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api, ClientPackage, MigrationImportBatch, MigrationMode, MigrationSourcePlatform, Payment, ClientWithStats } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList, SkeletonCard } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { ClientMergeModal } from "@/components/ClientMergeModal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatPrice, cn, formatPhoneInput, formatPhoneDisplay } from "@/lib/utils";

const DAY_MS = 86_400_000;

const MIGRATION_SOURCES: Array<{ value: MigrationSourcePlatform; label: string; hint: string }> = [
  { value: "square-appointments", label: "Square Appointments", hint: "Customer Directory export" },
  { value: "jane-app", label: "Jane App", hint: "Client list export" },
  { value: "vagaro", label: "Vagaro", hint: "Customer export" },
  { value: "acuity-scheduling", label: "Acuity Scheduling", hint: "Clients import/export CSV" },
  { value: "calendly", label: "Calendly", hint: "Contacts CSV" },
  { value: "fresha", label: "Fresha", hint: "Client export" },
  { value: "glossgenius", label: "GlossGenius", hint: "Client list export" },
  { value: "mindbody", label: "Mindbody", hint: "Assisted export recommended" },
  { value: "setmore", label: "Setmore", hint: "Customer CSV" },
  { value: "google-contacts", label: "Google Contacts", hint: "Google CSV export" },
  { value: "phone-contacts", label: "Phone contacts", hint: "CSV or vCard export" },
  { value: "csv", label: "Spreadsheet / CSV", hint: "Names, emails, phones, notes, tags" },
  { value: "other", label: "Other software", hint: "Pulse will inspect the file" },
  { value: "starting-fresh", label: "I'm starting fresh", hint: "No import needed" },
];

function parseCsv(data: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < data.length; i++) {
    const ch = data[i];
    const next = data[i + 1];
    if (inQ) {
      if (ch === '"' && next === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQ = true; }
      else if (ch === ",") { row.push(cur.trim()); cur = ""; }
      else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        row.push(cur.trim());
        result.push(row);
        row = [];
        cur = "";
        if (ch === "\r") i++;
      } else { cur += ch; }
    }
  }
  if (cur || row.length) { row.push(cur.trim()); result.push(row); }
  return result.filter((r) => r.some(Boolean));
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase();
}

function rowsFromCsv(text: string) {
  const allRows = parseCsv(text);
  if (allRows.length < 2) return [];
  const headers = allRows[0].map(normalizeHeader);
  return allRows.slice(1).map((vals) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return {
      name: obj.name ?? obj["full name"] ?? obj.fullname ?? obj["client name"] ?? "",
      email: obj.email ?? obj["email address"] ?? obj["e-mail"] ?? "",
      phone: obj.phone ?? obj.mobile ?? obj["phone number"] ?? obj["mobile phone"] ?? "",
      tags: obj.tags ?? obj.tag ?? "",
      notes: obj.notes ?? obj.note ?? obj["client notes"] ?? "",
    };
  }).filter((row) => row.name || row.email || row.phone);
}

function dueAtForCadence(cadenceDays: number) {
  return new Date(Date.now() + cadenceDays * DAY_MS).toISOString();
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<(ClientWithStats & { appointments?: unknown[]; payments?: Payment[]; packages?: ClientPackage[]; messages?: Array<{ id: string; content: string; fromClient: boolean; createdAt: string }> }) | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [deletingClient, setDeletingClient] = useState(false);
  const [blockingClient, setBlockingClient] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", notes: "", birthday: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [dueBusy, setDueBusy] = useState(false);
  const [dueSet, setDueSet] = useState<number | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tagBusy, setTagBusy] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ businessId: string | null; role: string } | null>(null);
  const [showMigration, setShowMigration] = useState(false);
  const [migrationSource, setMigrationSource] = useState<MigrationSourcePlatform>("square-appointments");
  const [migrationMode, setMigrationMode] = useState<MigrationMode>("SELF_SERVICE");
  const [migrationNotes, setMigrationNotes] = useState("");
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationBatch, setMigrationBatch] = useState<MigrationImportBatch | null>(null);
  const [migrationFileName, setMigrationFileName] = useState("");
  const [migrationSubmitted, setMigrationSubmitted] = useState(false);

  const router = useRouter();
  const migrationFileInputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const openClientIdRef = useRef<string | null>(null);

  // Use a live session check instead of relying on the booking_user hint cookie
  // which can be stale or missing while the session is valid.
  useEffect(() => {
    api.users.me().then(setCurrentUser).catch(() => {
      setLoading(false);
      setLoadError("Could not verify your session. Please refresh the page.");
    });
  }, []);

  const bizId = currentUser?.businessId ?? "";
  const isOwner = currentUser?.role === "OWNER" || currentUser?.role === "ADMIN";

  const load = useCallback(async (q?: string, pg = 1, append = false) => {
    if (!currentUser) return;
    if (!bizId) {
      setLoadError("No business account is linked to your profile. Please contact support.");
      setLoading(false);
      return;
    }
    if (!isOwner) {
      setLoadError("Access denied. Only owners and admins can manage the client list.");
      setLoading(false);
      return;
    }
    if (!append) { setLoadError(""); setLoading(true); } else setLoadingMore(true);
    try {
      const res = await api.clients.list(bizId, q, pg);
      setClients((prev) => append ? [...prev, ...res.data] : res.data);
      setPage(res.page);
      setTotalPages(res.pages);
      setTotal(res.total);
    }
    catch (e) { setLoadError(e instanceof Error ? e.message : "Failed to load clients"); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [bizId, isOwner, currentUser]);

  useEffect(() => { load(); }, [load]);

  // Debounced search. Skip the first run: the mount load above already fetched
  // page 1, and firing this on mount too caused a second load that flashed the
  // list back to skeletons right after it appeared ("static-TV" flicker).
  const searchReady = useRef(false);
  useEffect(() => {
    if (!searchReady.current) { searchReady.current = true; return; }
    const t = setTimeout(() => { setPage(1); load(search, 1); }, 300);
    return () => clearTimeout(t);
  }, [search, load]);

  useEffect(() => {
    const newId = selected?.id ?? null;
    if (newId !== null && newId !== openClientIdRef.current) {
      openClientIdRef.current = newId;
      drawerRef.current?.focus();
    }
    if (newId === null) openClientIdRef.current = null;
  }, [selected]);

  async function openClient(c: ClientWithStats) {
    if (!bizId) return;
    setSelected(c);
    setEditMode(false);
    setDueSet(null);
    setLoadingDetail(true);
    try {
      // FIX: Use the client-specific payment history returned by the detail
      // endpoint (now limited to 50 server-side) instead of filtering a global
      // business-wide list of 100 latest payments.
      const [detail, packages, messages] = await Promise.all([
        api.clients.get(bizId, c.id),
        api.packages.listIssued(bizId, c.id).catch(() => []),
        api.messages.thread(bizId, c.id).catch(() => []),
      ]);
      setSelected({ ...c, ...detail, packages, messages });
    } catch { toast.error("Failed to load client details"); }
    finally { setLoadingDetail(false); }
  }

  async function addClient() {
    if (!form.name) { toast.error("Client name is required"); return; }
    if (!form.email && !form.phone) { toast.error("Email or phone number is required"); return; }
    if (!bizId) return;
    setSaving(true);
    try {
      await api.clients.create(bizId, form);
      toast.success("Client added");
      setShowAdd(false);
      setForm({ name: "", email: "", phone: "", notes: "" });
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function deleteClient() {
    if (!bizId || !selected) return;
    setDeleteDialog(true);
  }

  async function toggleBlock() {
    if (!bizId || !selected) return;
    const willBlock = !selected.isBlocked;
    setBlockingClient(true);
    try {
      const updated = await api.clients.setBlocked(bizId, selected.id, willBlock);
      setSelected((prev) => prev ? { ...prev, isBlocked: updated.isBlocked, blockedReason: updated.blockedReason } : prev);
      setClients((prev) => prev.map((c) => c.id === selected.id ? { ...c, isBlocked: updated.isBlocked, blockedReason: updated.blockedReason } : c));
      toast.success(willBlock ? "Client blocked from online booking" : "Client unblocked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update block status");
    } finally {
      setBlockingClient(false);
    }
  }

  async function confirmDeleteClient() {
    if (!bizId || !selected) return;
    setDeleteDialog(false);
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

  function startEdit() {
    if (!selected) return;
    setEditForm({
      name: selected.name ?? "",
      email: selected.email ?? "",
      phone: formatPhoneDisplay(selected.phone),
      notes: selected.notes ?? "",
      birthday: selected.birthday ?? "",
    });
    setEditMode(true);
  }

  async function saveTags(tags: string[]) {
    if (!bizId || !selected) return;
    setTagBusy(true);
    try {
      const updated = await api.clients.update(bizId, selected.id, { tags });
      setSelected((prev) => (prev ? { ...prev, ...updated } : prev));
      load(search, page);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update tags"); }
    finally { setTagBusy(false); }
  }
  function addTag() {
    const t = tagInput.trim();
    if (!t || !selected) return;
    const existing = selected.tags ?? [];
    if (existing.some((x) => x.toLowerCase() === t.toLowerCase())) { setTagInput(""); return; }
    setTagInput("");
    saveTags([...existing, t].slice(0, 20));
  }

  async function saveEdit() {
    if (!bizId || !selected) return;
    if (!editForm.name.trim()) { toast.error("Client name is required"); return; }
    if (!editForm.email.trim() && !editForm.phone.trim()) { toast.error("Email or phone number is required"); return; }
    setSavingEdit(true);
    try {
      const updated = await api.clients.update(bizId, selected.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
        birthday: editForm.birthday || undefined,
      });
      setSelected((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditMode(false);
      toast.success("Contact updated");
      load(search, page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update contact");
    } finally { setSavingEdit(false); }
  }

  // Rebook the same person: jump to New booking with this client pre-selected,
  // so the owner never creates a duplicate client for a repeat visit.
  function rebook() {
    if (!selected) return;
    router.push(`/dashboard/checkout?client=${selected.id}`);
  }

  async function setNextDue(cadenceDays: number) {
    if (!bizId || !selected) return;
    setDueBusy(true);
    try {
      const dueAt = dueAtForCadence(cadenceDays);
      await api.serviceDue.set(bizId, { clientId: selected.id, cadenceDays, dueAt });
      setDueSet(cadenceDays);
      toast.success("Follow-up routine set — you'll be reminded when it's due");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set follow-up");
    } finally { setDueBusy(false); }
  }

  function resetMigration() {
    setMigrationSource("square-appointments");
    setMigrationMode("SELF_SERVICE");
    setMigrationNotes("");
    setMigrationBusy(false);
    setMigrationBatch(null);
    setMigrationFileName("");
    setMigrationSubmitted(false);
    if (migrationFileInputRef.current) migrationFileInputRef.current.value = "";
  }

  function closeMigration() {
    setShowMigration(false);
    resetMigration();
  }

  async function submitMigrationHelp() {
    if (!bizId) return;
    setMigrationBusy(true);
    try {
      await api.migrations.create(bizId, {
        sourcePlatform: migrationSource,
        mode: migrationMode,
        requestedHelp: migrationMode !== "SELF_SERVICE",
        notes: migrationNotes.trim() || undefined,
      });
      setMigrationSubmitted(true);
      toast.success(migrationSource === "starting-fresh" ? "Marked as starting fresh" : "Migration request saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save migration request");
    } finally {
      setMigrationBusy(false);
    }
  }

  async function stageMigrationFile(file: File) {
    if (!bizId) return;
    setMigrationBusy(true);
    try {
      const text = await file.text();
      const rows = rowsFromCsv(text).slice(0, 1000);
      if (!rows.length) {
        toast.error("No client rows found. Make sure the file has columns for name, email, or phone.");
        return;
      }
      if (rows.length >= 1000) {
        toast.message("Preview limited to 1,000 rows. Split larger lists before importing.");
      }
      const request = await api.migrations.create(bizId, {
        sourcePlatform: migrationSource,
        mode: "SELF_SERVICE",
        notes: migrationNotes.trim() || undefined,
      });
      const batch = await api.migrations.stage(bizId, request.id, {
        sourcePlatform: migrationSource,
        fileName: file.name,
        rows,
      });
      setMigrationFileName(file.name);
      setMigrationBatch(batch);
      toast.success(`Reviewed ${batch.totalRows} clients before import`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not stage client import");
    } finally {
      setMigrationBusy(false);
      if (migrationFileInputRef.current) migrationFileInputRef.current.value = "";
    }
  }

  async function confirmMigrationImport() {
    if (!bizId || !migrationBatch) return;
    setMigrationBusy(true);
    try {
      const imported = await api.migrations.importBatch(bizId, migrationBatch.id, true);
      setMigrationBatch(imported);
      toast.success(`Imported ${imported.importedRows} client${imported.importedRows === 1 ? "" : "s"}`);
      await load(search, 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setMigrationBusy(false);
    }
  }

  const detail = selected as (ClientWithStats & {
    appointments?: Array<{ id: string; startsAt: string; status: string; service: { name: string }; staff: { user: { name: string } } }>;
    payments?: Payment[];
    packages?: ClientPackage[];
    messages?: Array<{ id: string; content: string; fromClient: boolean; createdAt: string }>;
  }) | null;
  const migrationSourceLabel = MIGRATION_SOURCES.find((source) => source.value === migrationSource)?.label ?? "your old app";

  return (
    <>
    <ConfirmDialog
      open={deleteDialog}
      title={`Delete ${selected?.name ?? "client"}?`}
      description="This removes the client profile and appointment history from the log. Payments remain in reporting."
      confirmLabel="Delete client"
      variant="destructive"
      onConfirm={confirmDeleteClient}
      onCancel={() => setDeleteDialog(false)}
    />
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Clients</h2>
          <p className="text-sm text-gray-500">{total} client{total !== 1 ? "s" : ""}</p>
        </div>
        {/* RBAC: Hide management controls from staff */}
        {isOwner && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowMerge(true)} className="gap-1.5"><GitMerge className="w-4 h-4" />Merge duplicates</Button>
            <a href={api.clients.exportCsv(bizId)} download="clients.csv"
              className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />Export CSV
            </a>
            <button
              type="button"
              onClick={() => setShowMigration(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50 transition-colors">
              <Upload className="w-4 h-4" />Move clients to Pulse
            </button>
            <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5"><Plus className="w-4 h-4" />Add client</Button>
          </div>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search by name, email, or phone…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9"
          aria-label="Search by name, email, or phone" />
      </div>

      {loadError ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3">{loadError}</p>
          <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">Retry</button>
        </div>
      ) : loading ? <SkeletonList rows={8} /> : clients.length === 0 ? (
        <EmptyState title="No clients found" description="Add your first client or adjust the search." />
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <button type="button" onClick={() => openClient(c)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-500 sm:gap-4 sm:px-6">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-sm shrink-0">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                    {c.isBlocked && <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"><Ban className="w-2.5 h-2.5" />Blocked</span>}
                    {(c.tags ?? []).slice(0, 3).map((t) => (
                      <span key={t} className="rounded-full bg-violet-50 text-violet-700 px-2 py-0.5 text-[10px] font-medium">{t}</span>
                    ))}
                  </div>
                  <div className="mt-0.5 flex flex-col gap-1 text-xs text-gray-500 sm:flex-row sm:items-center sm:gap-3">
                    <span className="flex min-w-0 items-center gap-1 break-all"><Mail className="w-3 h-3 shrink-0" />{c.email}</span>
                    {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 shrink-0" />{formatPhoneDisplay(c.phone)}</span>}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500 shrink-0 hidden sm:block">
                  <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />{c.totalVisits} visits</div>
                  {c.lastVisit && <div className="mt-0.5">Last: {format(new Date(c.lastVisit), "MMM d")}</div>}
                </div>
              </button>
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
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSelected(null)} aria-hidden="true" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-drawer-title"
            onKeyDown={(e) => { if (e.key === 'Escape') setSelected(null) }}
            tabIndex={-1}
            className="dashboard-safe-bottom fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col focus:outline-none">
            <div className="flex flex-col gap-3 px-4 py-4 border-b border-gray-100 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
              <div className="flex items-center gap-2 min-w-0">
                <h2 id="client-drawer-title" className="text-lg font-bold text-gray-900 truncate">{selected.name}</h2>
                {selected.isBlocked && <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"><Ban className="w-3 h-3" /> Blocked</span>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" onClick={rebook} className="gap-1.5">
                  <CalendarPlus className="w-4 h-4" />Book again
                </Button>
                {/* RBAC: Hide edit/delete for staff */}
                {isOwner && (
                  <>
                    <button onClick={startEdit} title="Edit contact" aria-label="Edit"
                      className="p-2 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button
                      onClick={toggleBlock}
                      disabled={blockingClient}
                      title={selected.isBlocked ? "Unblock client" : "Block client from online booking"}
                      aria-label={selected.isBlocked ? "Unblock client" : "Block client"}
                      className={cn("p-2 rounded-lg transition-colors disabled:opacity-50", selected.isBlocked ? "text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100" : "text-gray-400 hover:text-amber-600 hover:bg-amber-50")}>
                      {selected.isBlocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    </button>
                    <button onClick={deleteClient} disabled={deletingClient} title="Delete contact" aria-label="Delete client"
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
                <button onClick={() => setSelected(null)} aria-label="Close" className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {editMode ? (
                <div className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                  <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Edit contact</p>
                  {([
                    { k: "name",  label: "Full name *", type: "text",  ph: "Jane Doe" },
                    { k: "email", label: "Email",        type: "email", ph: "jane@example.com" },
                    { k: "phone", label: "Phone",        type: "tel",   ph: "+1 (416) 555-0123" },
                    { k: "notes", label: "Notes",        type: "text",  ph: "" },
                  ] as const).map(({ k, label, type, ph }) => (
                    <div key={k}>
                      <label htmlFor={`edit-${k}`} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                      <Input id={`edit-${k}`} type={type} placeholder={ph} value={editForm[k]}
                        aria-required={k === "name" ? "true" : undefined}
                        onChange={(e) => {
                          const val = k === "phone" ? formatPhoneInput(e.target.value) : e.target.value;
                          setEditForm((p) => ({ ...p, [k]: val }));
                        }} />
                      {k === "phone" && <p className="mt-1 text-xs text-gray-500">At least one of email or phone is required.</p>}
                    </div>
                  ))}
                  <div>
                    <label htmlFor="edit-birthday" className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
                    <Input id="edit-birthday" type="date" value={editForm.birthday ? `2000-${editForm.birthday}` : ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, birthday: e.target.value ? e.target.value.slice(5) : "" }))} />
                    <p className="mt-1 text-xs text-gray-500">Used for an automatic birthday greeting (year is ignored).</p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="secondary" className="flex-1" onClick={() => setEditMode(false)}>Cancel</Button>
                    <Button className="flex-1" loading={savingEdit} onClick={saveEdit}>Save</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-sm">
                  <div className="flex min-w-0 items-center gap-2 break-all text-gray-600"><Mail className="w-4 h-4 shrink-0 text-gray-400" />{selected.email}</div>
                  {selected.phone && <div className="flex items-center gap-2 text-gray-600"><Phone className="w-4 h-4 text-gray-400" />{formatPhoneDisplay(selected.phone)}</div>}
                  {selected.birthday && <div className="flex items-center gap-2 text-gray-600"><span className="w-4 text-center">🎂</span>{format(new Date(`2000-${selected.birthday}T00:00:00`), "MMMM d")}</div>}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-3">
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

              {/* Recurring follow-up: set when this client's next visit is due */}
              <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                <p className="text-sm font-semibold text-violet-900">Next visit due</p>
                <p className="text-xs text-violet-700 mt-0.5">
                  {dueSet
                    ? `Routine set — we'll remind you when it's due, and you can approve a rebook nudge.`
                    : `Put this client on a routine (e.g. grooming every 8 weeks). You'll be prompted to invite them back when it's due.`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { d: 14, l: "2 weeks" }, { d: 30, l: "Monthly" }, { d: 42, l: "6 weeks" }, { d: 56, l: "8 weeks" },
                  ].map(({ d, l }) => (
                    <button key={d} disabled={dueBusy || !isOwner} onClick={() => setNextDue(d)}
                      className={cn("text-xs font-semibold rounded-lg px-3 py-1.5 border transition-colors disabled:opacity-50",
                        dueSet === d ? "bg-violet-600 text-white border-violet-600" : "bg-white border-violet-200 text-violet-700 hover:bg-violet-100")}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</p>
                <div className="flex flex-wrap items-center gap-2">
                  {(selected.tags ?? []).map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                      {t}
                      {isOwner && (
                        <button disabled={tagBusy} onClick={() => saveTags((selected.tags ?? []).filter((x) => x !== t))}
                          className="text-violet-400 hover:text-red-600" aria-label={`Remove ${t}`}>×</button>
                      )}
                    </span>
                  ))}
                  {isOwner && (
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                      onBlur={addTag}
                      placeholder="+ Add tag"
                      aria-label="Add tag"
                      className="text-xs px-2 py-1 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-200 w-24" />
                  )}
                </div>
              </div>

              {selected.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{selected.notes}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Appointment history</p>
                {loadingDetail ? <div className="space-y-2 py-2"><SkeletonCard /><SkeletonCard /></div> :
                  (detail?.appointments?.length ?? 0) === 0 ? <p className="text-sm text-gray-500">No appointments yet.</p> : (
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
                    {detail?.appointments?.length === 50 && <p className="text-[10px] text-gray-400 text-center pt-2">Showing last 50 appointments</p>}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payments</p>
                {loadingDetail ? <div className="space-y-2 py-2"><SkeletonCard /></div> :
                  (detail?.payments?.length ?? 0) === 0 ? <p className="text-sm text-gray-500">No payments recorded.</p> : (
                  <div className="space-y-2">
                    {(detail?.payments ?? []).map((p) => (
                      <div key={p.id} className="flex items-center justify-between border-b border-gray-100 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{formatPrice(p.amountCents - p.refundedCents)}</p>
                          <p className="text-xs text-gray-500">{p.kind.replaceAll("_", " ")} · {format(new Date(p.createdAt), "MMM d, yyyy")}</p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{p.status.replaceAll("_", " ")}</span>
                      </div>
                    ))}
                    {detail?.payments?.length === 50 && <p className="text-[10px] text-gray-400 text-center pt-2">Showing last 50 payments</p>}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Packages</p>
                {(detail?.packages?.length ?? 0) === 0 ? <p className="text-sm text-gray-500">No active packages.</p> : (
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
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent messages</p>
                {(detail?.messages?.length ?? 0) === 0 ? <p className="text-sm text-gray-500">No messages yet.</p> : (
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
        <div className="dashboard-safe-bottom fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAdd(false)} aria-hidden="true" />
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-client-modal-title"
            onKeyDown={(e) => { if (e.key === 'Escape') setShowAdd(false) }}
            tabIndex={-1}
            className="relative w-full max-w-sm z-10">
            <CardHeader><CardTitle id="add-client-modal-title">Add client</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { k:"name",  label:"Full name *",   type:"text",  ph:"Jane Doe" },
                { k:"email", label:"Email",          type:"email", ph:"jane@example.com" },
                { k:"phone", label:"Phone",          type:"tel",   ph:"+1 (416) 555-0123" },
                { k:"notes", label:"Notes",          type:"text",  ph:"Any notes…" },
              ].map(({ k, label, type, ph }) => (
                <div key={k}>
                  <label htmlFor={`add-${k}`} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <Input id={`add-${k}`} type={type} placeholder={ph} value={form[k as keyof typeof form]}
                    aria-required={k === "name" ? "true" : undefined}
                    autoFocus={k === "name"}
                    onChange={(e) => {
                      const val = k === "phone" ? formatPhoneInput(e.target.value) : e.target.value;
                      setForm((p) => ({ ...p, [k]: val }));
                    }} />
                  {k === "phone" && <p className="mt-1 text-xs text-gray-500">At least one of email or phone is required.</p>}
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

      {showMigration && (
        <div className="dashboard-safe-bottom fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeMigration} aria-hidden="true" />
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby="migration-modal-title"
            onKeyDown={(e) => { if (e.key === "Escape") closeMigration(); }}
            tabIndex={-1}
            className="relative z-10 w-full max-w-2xl">
            <CardHeader>
              <CardTitle id="migration-modal-title">Move clients to Pulse</CardTitle>
              <p className="text-sm text-gray-500">Choose where you are moving from, then upload a file for review or ask Pulse to help.</p>
            </CardHeader>
            <CardContent className="space-y-5">
              {migrationSubmitted ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-semibold text-emerald-900">Migration request saved</p>
                  <p className="mt-1 text-sm text-emerald-800">
                    Your request for {migrationSourceLabel} is ready for follow-up. You can keep adding clients manually while migration is reviewed.
                  </p>
                  <div className="mt-4 flex justify-end">
                    <Button onClick={closeMigration}>Done</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="migration-source" className="block text-sm font-medium text-gray-700 mb-1">Where are you moving from?</label>
                    <select
                      id="migration-source"
                      value={migrationSource}
                      onChange={(e) => {
                        const nextSource = e.target.value as MigrationSourcePlatform;
                        setMigrationSource(nextSource);
                        if (nextSource === "starting-fresh") setMigrationMode("SELF_SERVICE");
                      }}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
                      {MIGRATION_SOURCES.map((source) => (
                        <option key={source.value} value={source.value}>{source.label} - {source.hint}</option>
                      ))}
                    </select>
                  </div>

                  {migrationSource !== "starting-fresh" && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {([
                        { mode: "DONE_FOR_YOU", title: "Let Pulse migrate", desc: "Best if you want help reviewing the file." },
                        { mode: "SELF_SERVICE", title: "I'll upload a file", desc: "Preview, catch issues, then import valid rows." },
                        { mode: "ASSISTED_CALL", title: "Book guided help", desc: "Use this for complex exports or large lists." },
                      ] as const).map((option) => (
                        <button
                          key={option.mode}
                          type="button"
                          onClick={() => setMigrationMode(option.mode)}
                          className={cn(
                            "rounded-xl border p-3 text-left transition-colors",
                            migrationMode === option.mode ? "border-violet-300 bg-violet-50" : "border-gray-200 bg-white hover:bg-gray-50"
                          )}>
                          <p className="text-sm font-semibold text-gray-900">{option.title}</p>
                          <p className="mt-1 text-xs text-gray-500">{option.desc}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  <div>
                    <label htmlFor="migration-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes for migration</label>
                    <textarea
                      id="migration-notes"
                      value={migrationNotes}
                      onChange={(e) => setMigrationNotes(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="Example: I have about 400 clients and want tags/notes preserved."
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>

                  {migrationSource === "starting-fresh" ? (
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={closeMigration}>Cancel</Button>
                      <Button loading={migrationBusy} onClick={submitMigrationHelp}>Save</Button>
                    </div>
                  ) : migrationMode === "SELF_SERVICE" ? (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                        <p className="text-sm font-semibold text-gray-900">Upload a CSV from {migrationSourceLabel}</p>
                        <p className="mt-1 text-xs text-gray-500">Pulse will stage the file first. Nothing is imported until you review and confirm.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button variant="secondary" loading={migrationBusy} onClick={() => migrationFileInputRef.current?.click()}>
                            <Upload className="w-4 h-4 mr-1.5" />Choose CSV
                          </Button>
                          <input
                            ref={migrationFileInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) stageMigrationFile(file);
                            }} />
                          {migrationFileName && <span className="self-center text-xs text-gray-500">{migrationFileName}</span>}
                        </div>
                      </div>

                      {migrationBatch && (
                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">Migration confidence: {migrationBatch.confidenceScore}%</p>
                              <p className="mt-1 text-xs text-gray-500">{migrationBatch.totalRows} rows reviewed before import</p>
                            </div>
                            <Button
                              loading={migrationBusy}
                              disabled={migrationBatch.status === "IMPORTED" || migrationBatch.validRows === 0}
                              onClick={confirmMigrationImport}>
                              {migrationBatch.status === "IMPORTED" ? "Imported" : "Import valid clients"}
                            </Button>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {[
                              ["Valid", migrationBatch.validRows, "text-emerald-700 bg-emerald-50"],
                              ["Duplicates", migrationBatch.duplicateRows, "text-amber-700 bg-amber-50"],
                              ["Need fixes", migrationBatch.invalidRows, "text-red-700 bg-red-50"],
                              ["Imported", migrationBatch.importedRows, "text-violet-700 bg-violet-50"],
                            ].map(([label, value, tone]) => (
                              <div key={label} className={cn("rounded-lg px-3 py-2 text-center", tone as string)}>
                                <p className="text-base font-bold">{value}</p>
                                <p className="text-[11px] font-medium">{label}</p>
                              </div>
                            ))}
                          </div>
                          {(migrationBatch.rows ?? []).some((row) => row.status !== "VALID") && (
                            <div className="mt-4 max-h-36 overflow-y-auto rounded-lg border border-gray-100">
                              {(migrationBatch.rows ?? []).filter((row) => row.status !== "VALID").slice(0, 8).map((row) => (
                                <div key={row.id} className="border-b border-gray-100 px-3 py-2 text-xs last:border-b-0">
                                  <p className="font-semibold text-gray-700">Row {row.rowNumber}: {row.status}</p>
                                  <p className="mt-0.5 text-gray-500">{[...row.errors, ...row.warnings].join(", ") || "Possible duplicate"}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={closeMigration}>Close</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={closeMigration}>Cancel</Button>
                      <Button loading={migrationBusy} onClick={submitMigrationHelp}>Request migration help</Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showMerge && bizId && (
        <ClientMergeModal bizId={bizId} onClose={() => setShowMerge(false)} onMerged={() => load(search, 1)} />
      )}
    </div>
    </>
  );
}
