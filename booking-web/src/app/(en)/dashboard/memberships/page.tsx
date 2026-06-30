"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, Plus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { api, Business, ClientWithStats, MembershipPlan, MembershipMember } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDashboardLocale } from "@/lib/dashboard-locale";

type Tab = "plans" | "members";

export default function MembershipsPage() {
  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";
  const [tab, setTab] = useState<Tab>("plans");
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [members, setMembers] = useState<MembershipMember[]>([]);
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState({ name: "", description: "", priceMonthly: "" });
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ clientId: "", planId: "" });
  const [enrolling, setEnrolling] = useState(false);
  const [memberToCancel, setMemberToCancel] = useState<MembershipMember | null>(null);
  const { french, formatCurrency } = useDashboardLocale();

  const load = useCallback(async () => {
    try {
      const [p, m, c, b] = await Promise.all([
        api.memberships.listPlans(bizId),
        api.memberships.listMembers(bizId),
        api.clients.list(bizId, undefined, 1, 100),
        api.business.get(bizId),
      ]);
      setPlans(p); setMembers(m); setClients(c.data);
      setBusiness(b);
    } catch { toast.error(french ? "Impossible de charger les abonnements" : "Could not load memberships"); }
    finally { setLoading(false); }
  }, [bizId, french]);

  useEffect(() => { if (bizId) void load(); }, [bizId, load]);

  useEffect(() => {
    if (!bizId) return;
    const params = new URLSearchParams(window.location.search);
    const cancelledMembershipId = params.get("membership_id");
    if (params.get("membership") === "cancel" && cancelledMembershipId) {
      api.memberships.cancel(bizId, cancelledMembershipId)
        .then(() => load())
        .catch((error) => toast.error(error instanceof Error ? error.message : "Could not cancel membership"))
        .finally(() => window.history.replaceState({}, "", "/dashboard/memberships"));
      return;
    }
    const sessionId = params.get("session_id");
    if (params.get("membership") !== "success" || !sessionId) return;
    api.memberships.confirm(bizId, sessionId)
      .then((result) => {
        if (result.confirmed) toast.success("Membership activated");
        else toast.error("Membership checkout is not complete");
        return load();
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not confirm membership"))
      .finally(() => window.history.replaceState({}, "", "/dashboard/memberships"));
  }, [bizId, load]);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    const price = parseFloat(planForm.priceMonthly);
    if (!planForm.name.trim() || !price || price <= 0) { toast.error("Name and monthly price are required"); return; }
    try {
      const plan = await api.memberships.createPlan(bizId!, { name: planForm.name.trim(), description: planForm.description.trim() || undefined, priceMonthly: Math.round(price * 100) });
      setPlans(p => [...p, plan]);
      setPlanForm({ name: "", description: "", priceMonthly: "" });
      setShowPlanForm(false);
      toast.success("Plan created");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  async function togglePlan(plan: MembershipPlan) {
    const prev = plan.active;
    setPlans(p => p.map(x => x.id === plan.id ? { ...x, active: !x.active } : x));
    try {
      const updated = await api.memberships.updatePlan(bizId!, plan.id, { active: !plan.active });
      setPlans(p => p.map(x => x.id === plan.id ? updated : x));
    } catch (e) {
      setPlans(p => p.map(x => x.id === plan.id ? { ...x, active: prev } : x));
      toast.error(e instanceof Error ? e.message : "Failed to update plan");
    }
  }

  async function doCancelMembership() {
    if (!memberToCancel) return;
    try {
      await api.memberships.cancel(bizId!, memberToCancel.id);
      setMemberToCancel(null);
      await load();
      toast.success("Membership will cancel at the end of the billing period");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to cancel"); setMemberToCancel(null); }
  }

  async function enrollClient(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollForm.clientId || !enrollForm.planId) { toast.error("Choose a client and plan"); return; }
    setEnrolling(true);
    try {
      const { url } = await api.memberships.subscribe(bizId, enrollForm.clientId, enrollForm.planId);
      window.location.assign(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start membership checkout");
      setEnrolling(false);
    }
  }

  const activeMembers = members.filter(m => m.status === "ACTIVE");
  const monthlyRevenue = activeMembers.reduce((s, m) => s + m.plan.priceMonthly, 0);
  const membershipsEnabled = business?.capabilities?.memberships ?? false;

  if (!bizId) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ConfirmDialog
        open={memberToCancel !== null}
        title={french ? `Annuler l’abonnement de ${memberToCancel?.client.name}?` : `Cancel ${memberToCancel?.client.name}'s membership?`}
        description={french ? `Le forfait ${memberToCancel?.plan.name} restera actif jusqu’à la fin de la période de facturation.` : `Their ${memberToCancel?.plan.name} plan will remain active until the end of the current billing period.`}
        confirmLabel={french ? "Annuler l’abonnement" : "Cancel membership"}
        variant="destructive"
        onConfirm={doCancelMembership}
        onCancel={() => setMemberToCancel(null)}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Crown className="w-6 h-6 text-amber-500" /> {french ? "Abonnements" : "Memberships"}</h1>
          <p className="text-sm text-gray-500 mt-1">{french ? "Forfaits mensuels récurrents pour vos meilleurs clients." : "Recurring monthly plans for your best clients."}</p>
        </div>
        {tab === "plans" ? (
          <Button onClick={() => setShowPlanForm(s => !s)} disabled={!membershipsEnabled} className="gap-2"><Plus className="w-4 h-4" /> {french ? "Nouveau forfait" : "New plan"}</Button>
        ) : (
          <Button onClick={() => setShowEnrollForm(s => !s)} disabled={!membershipsEnabled} className="gap-2"><Plus className="w-4 h-4" /> {french ? "Inscrire un client" : "Enroll client"}</Button>
        )}
      </div>

      {!membershipsEnabled && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Memberships require a paid Pulse plan. Upgrade to create plans and enroll clients.
        </div>
      )}

      {activeMembers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-xs text-amber-600 font-medium">{french ? "Membres actifs" : "Active members"}</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{activeMembers.length}</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
            <p className="text-xs text-green-600 font-medium">{french ? "Revenu mensuel récurrent" : "Monthly recurring"}</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(monthlyRevenue)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["plans", "members"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{french ? (t === "plans" ? "forfaits" : "membres") : t}</button>
        ))}
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">{french ? "Chargement…" : "Loading…"}</div> : tab === "plans" ? (
        <div className="space-y-4">
          {showPlanForm && (
            <form onSubmit={createPlan} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <h2 className="font-semibold text-gray-900">{french ? "Nouveau forfait d’abonnement" : "New membership plan"}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{french ? "Nom du forfait" : "Plan name"}</label>
                  <Input placeholder="e.g. Monthly Unlimited" value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{french ? "Prix mensuel ($)" : "Monthly price ($)"}</label>
                  <Input type="number" min={1} step="0.01" placeholder="79.00" value={planForm.priceMonthly} onChange={e => setPlanForm(p => ({ ...p, priceMonthly: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Description (optional)</label>
                  <Input placeholder="e.g. Unlimited haircuts + 10% off products" value={planForm.description} onChange={e => setPlanForm(p => ({ ...p, description: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">{french ? "Créer le forfait" : "Create plan"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowPlanForm(false)}>{french ? "Annuler" : "Cancel"}</Button>
              </div>
            </form>
          )}
          {plans.length === 0 && !showPlanForm ? (
            <div className="text-center py-16 text-gray-400">
              <Crown className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{french ? "Aucun forfait" : "No plans yet"}</p>
              <p className="text-sm mt-1">{french ? "Créez un forfait mensuel et inscrivez des clients pour générer des revenus récurrents." : "Create a monthly plan and enroll clients to generate recurring revenue."}</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 shadow-sm">
              {plans.map(plan => (
                <div key={plan.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900">{plan.name}</span>
                      {!plan.active && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(plan.priceMonthly)}/{french ? "mois" : "mo"}{plan.description ? ` · ${plan.description}` : ""}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{members.filter(m => m.planId === plan.id && m.status === "ACTIVE").length} active members</p>
                  </div>
                  <button onClick={() => togglePlan(plan)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">{plan.active ? "Deactivate" : "Activate"}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {showEnrollForm && (
            <form onSubmit={enrollClient} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="font-semibold text-gray-900">{french ? "Inscrire un client" : "Enroll a client"}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <select className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-base lg:text-sm" value={enrollForm.clientId} onChange={(e) => setEnrollForm((f) => ({ ...f, clientId: e.target.value }))}>
                  <option value="">{french ? "Choisir un client" : "Choose client"}</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.email ? ` - ${client.email}` : ""}</option>)}
                </select>
                <select className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-base lg:text-sm" value={enrollForm.planId} onChange={(e) => setEnrollForm((f) => ({ ...f, planId: e.target.value }))}>
                  <option value="">{french ? "Choisir un forfait" : "Choose plan"}</option>
                  {plans.filter((plan) => plan.active).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} - {formatCurrency(plan.priceMonthly)}/{french ? "mois" : "mo"}</option>)}
                </select>
              </div>
              <div className="flex gap-2"><Button type="submit" disabled={enrolling}>{enrolling ? (french ? "Ouverture du paiement…" : "Opening checkout...") : (french ? "Continuer vers Stripe" : "Continue to Stripe")}</Button><Button type="button" variant="outline" onClick={() => setShowEnrollForm(false)}>{french ? "Annuler" : "Cancel"}</Button></div>
            </form>
          )}
          {members.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{french ? "Aucun membre" : "No members yet"}</p>
              <p className="text-sm mt-1">{french ? "Inscrivez des clients depuis leur profil." : "Enroll clients from their profile page."}</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 shadow-sm">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900">{m.client.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${m.status === "ACTIVE" ? "bg-green-50 text-green-700" : m.status === "PAST_DUE" ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-500"}`}>{m.cancelAtPeriodEnd ? "CANCELS AT PERIOD END" : m.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{m.plan.name} · {formatCurrency(m.plan.priceMonthly)}/{french ? "mois" : "mo"}</p>
                    {m.client.email && <p className="text-xs text-gray-400">{m.client.email}</p>}
                  </div>
                  {m.status === "ACTIVE" && !m.cancelAtPeriodEnd && (
                    <button onClick={() => setMemberToCancel(m)} aria-label="Cancel membership" className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
