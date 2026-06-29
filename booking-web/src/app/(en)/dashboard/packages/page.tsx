"use client";

import { useEffect, useState, useCallback } from "react";
import { Package as PackageIcon, Plus, Trash2, Ban, Ticket, Tag } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api, type Package, type ClientPackage, type Service, type ClientWithStats, type PackageStatus } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function PackagesPage() {
  const [tab, setTab] = useState<"products" | "issued">("products");
  const [products, setProducts] = useState<Package[]>([]);
  const [issued, setIssued] = useState<ClientPackage[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Package | null>(null);
  const [cpToVoid, setCpToVoid] = useState<ClientPackage | null>(null);
  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoadError("");
    setLoading(true);
    try {
      const [p, i, s] = await Promise.all([
        api.packages.list(bizId),
        api.packages.listIssued(bizId),
        api.services.list(bizId),
      ]);
      setProducts(p); setIssued(i); setServices(s);
    } catch (e) { setLoadError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const svcName = (id?: string | null) => services.find((s) => s.id === id)?.name ?? "Any service";

  async function doRemoveProduct() {
    if (!productToDelete) return;
    try { await api.packages.remove(bizId, productToDelete.id); setProductToDelete(null); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); setProductToDelete(null); }
  }
  async function redeem(cp: ClientPackage) {
    try { const r = await api.packages.redeem(bizId, cp.id); toast.success(`Credit used — ${r.creditsRemaining} left`); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function doVoidCP() {
    if (!cpToVoid) return;
    try { await api.packages.void(bizId, cpToVoid.id); setCpToVoid(null); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); setCpToVoid(null); }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <ConfirmDialog
        open={productToDelete !== null}
        title={`Delete "${productToDelete?.name}"?`}
        description="Already-issued packages are kept. Only the product template is removed."
        confirmLabel="Delete package"
        variant="destructive"
        onConfirm={doRemoveProduct}
        onCancel={() => setProductToDelete(null)}
      />
      <ConfirmDialog
        open={cpToVoid !== null}
        title={`Void ${cpToVoid?.client?.name ?? "client"}'s "${cpToVoid?.name}"?`}
        description="The remaining credits will be cancelled."
        confirmLabel="Void"
        variant="destructive"
        onConfirm={doVoidCP}
        onCancel={() => setCpToVoid(null)}
      />
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900">Packages</h2>
        <p className="text-sm text-gray-500">Sell prepaid session bundles, then redeem credits as clients visit.</p>
      </div>

      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50">
          {(["products", "issued"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? "bg-white text-violet-700 shadow-sm" : "text-gray-500"}`}>
              {t === "products" ? "Package products" : "Issued"}
            </button>
          ))}
        </div>
        {tab === "products" && !creating && <Button onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1.5" /> New package</Button>}
        {tab === "issued" && !issuing && <Button onClick={() => setIssuing(true)}><Ticket className="w-4 h-4 mr-1.5" /> Issue</Button>}
      </div>

      {tab === "products" && creating && (
        <ProductForm bizId={bizId} services={services} onDone={() => { setCreating(false); load(); }} onCancel={() => setCreating(false)} />
      )}
      {tab === "issued" && issuing && (
        <IssueForm bizId={bizId} products={products} services={services} onDone={() => { setIssuing(false); load(); }} onCancel={() => setIssuing(false)} />
      )}

      {loadError ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3">{loadError}</p>
          <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">Retry</button>
        </div>
      ) : loading ? <LoadingSpinner /> : tab === "products" ? (
        products.length === 0 && !creating ? <EmptyState title="No package products yet" icon={PackageIcon} description="Define a bundle like “5x Haircut — $200”." /> : (
          <div className="space-y-3 mt-4">
            {products.map((p) => (
              <Card key={p.id} className={p.active ? "" : "opacity-60"}>
                <CardContent className="py-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <PackageIcon className="w-4 h-4 text-violet-500 shrink-0" />
                      <span className="font-medium text-gray-900 truncate">{p.name}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{p.credits} credits · {svcName(p.serviceId)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">{formatPrice(p.priceCents)}</p>
                    <button onClick={() => setProductToDelete(p)} className="text-xs text-gray-400 hover:text-red-600 inline-flex items-center gap-1 mt-1"><Trash2 className="w-3 h-3" /> Delete</button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        issued.length === 0 && !issuing ? <EmptyState title="No issued packages yet" icon={Ticket} description="Issue a package to a client to track their credits." /> : (
          <div className="space-y-3 mt-4">
            {issued.map((cp) => (
              <Card key={cp.id} className={cp.status === "ACTIVE" ? "" : "opacity-70"}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">{cp.client?.name ?? "Client"}</span>
                        <StatusPill status={cp.status} />
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{cp.name} · {svcName(cp.serviceId)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Issued {format(new Date(cp.createdAt), "MMM d, yyyy")}
                        {cp.expiresAt ? ` · expires ${format(new Date(cp.expiresAt), "MMM d, yyyy")}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-gray-900">{cp.creditsRemaining}<span className="text-sm text-gray-400 font-normal">/{cp.creditsTotal}</span></p>
                      <p className="text-xs text-gray-400">credits left</p>
                      {cp.status === "ACTIVE" && (
                        <div className="flex gap-2 justify-end mt-1.5">
                          <button onClick={() => redeem(cp)} className="text-xs text-violet-600 hover:underline font-medium">Use credit</button>
                          <button onClick={() => setCpToVoid(cp)} aria-label="Void package" className="text-xs text-gray-400 hover:text-red-600 inline-flex items-center gap-1"><Ban className="w-3 h-3" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function StatusPill({ status }: { status: PackageStatus }) {
  const map = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    USED: "bg-gray-100 text-gray-500",
    EXPIRED: "bg-amber-100 text-amber-700",
    VOID: "bg-red-100 text-red-600",
  } as const;
  return <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${map[status]}`}>{status}</span>;
}

function ProductForm({ bizId, services, onDone, onCancel }: { bizId: string; services: Service[]; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [credits, setCredits] = useState("5");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const c = parseInt(credits, 10); const pr = parseFloat(price);
    if (!name.trim()) { toast.error("Name your package"); return; }
    if (!c || c < 1) { toast.error("Credits must be at least 1"); return; }
    if (isNaN(pr) || pr < 0) { toast.error("Enter a price"); return; }
    setSaving(true);
    try {
      await api.packages.create(bizId, { name, serviceId: serviceId || undefined, credits: c, priceCents: Math.round(pr * 100) });
      toast.success("Package created"); onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Card className="border-violet-200">
      <CardContent className="py-5 space-y-3">
        <Input placeholder="Package name, e.g. “5x Haircut”" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="pkg-credits" className="text-xs font-medium text-gray-500">Credits</label>
            <Input id="pkg-credits" type="number" min={1} value={credits} onChange={(e) => setCredits(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pkg-price" className="text-xs font-medium text-gray-500">Price ($)</label>
            <Input id="pkg-price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pkg-service" className="text-xs font-medium text-gray-500">Service</label>
            <select id="pkg-service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 bg-white">
              <option value="">Any service</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Create package</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IssueForm({ bizId, products, services, onDone, onCancel }: { bizId: string; products: Package[]; services: Service[]; onDone: () => void; onCancel: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ClientWithStats[]>([]);
  const [client, setClient] = useState<ClientWithStats | null>(null);
  const [packageId, setPackageId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client || search.trim().length < 2) { setResults([]); return; }
    let live = true;
    const t = setTimeout(() => {
      api.clients.list(bizId, search.trim(), 1, 8).then((r) => { if (live) setResults(r.data); }).catch(() => {});
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [search, client, bizId]);

  async function submit() {
    if (!client) { toast.error("Pick a client"); return; }
    if (!packageId) { toast.error("Pick a package"); return; }
    setSaving(true);
    try {
      await api.packages.issue(bizId, { clientId: client.id, packageId });
      toast.success(`Package issued to ${client.name}`); onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  const svcName = (id?: string | null) => services.find((s) => s.id === id)?.name ?? "Any service";

  return (
    <Card className="border-violet-200">
      <CardContent className="py-5 space-y-3">
        {client ? (
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
            <span className="text-sm font-medium text-gray-800">{client.name} <span className="text-gray-400 font-normal">· {client.email}</span></span>
            <button onClick={() => { setClient(null); setSearch(""); }} className="text-xs text-violet-600 hover:underline">Change</button>
          </div>
        ) : (
          <div className="relative">
            <Input placeholder="Search client by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-sm max-h-52 overflow-y-auto">
                {results.map((c) => (
                  <button key={c.id} onClick={() => { setClient(c); setResults([]); }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-violet-50">
                    {c.name} <span className="text-gray-400">· {c.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {products.length === 0 ? (
          <p className="text-sm text-gray-400 flex items-center gap-1.5"><Tag className="w-4 h-4" /> Create a package product first.</p>
        ) : (
          <select value={packageId} onChange={(e) => setPackageId(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 bg-white">
            <option value="">Select a package…</option>
            {products.filter((p) => p.active).map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.credits} credits · {svcName(p.serviceId)} · {formatPrice(p.priceCents)}</option>
            ))}
          </select>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={!client || !packageId}>Issue package</Button>
        </div>
      </CardContent>
    </Card>
  );
}
