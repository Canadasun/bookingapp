"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, Plus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { api, MembershipPlan, MembershipMember } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";

type Tab = "plans" | "members";

export default function MembershipsPage() {
  const bizId = getUser()?.businessId ?? "";
  const [tab, setTab] = useState<Tab>("plans");
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [members, setMembers] = useState<MembershipMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState({ name: "", description: "", priceMonthly: "" });

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([api.memberships.listPlans(bizId), api.memberships.listMembers(bizId)]);
      setPlans(p); setMembers(m);
    } catch { toast.error("Could not load memberships"); }
    finally { setLoading(false); }
  }, [bizId]);

  useEffect(() => { if (bizId) void load(); }, [bizId, load]);

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
    try {
      const updated = await api.memberships.updatePlan(bizId!, plan.id, { active: !plan.active });
      setPlans(p => p.map(x => x.id === plan.id ? updated : x));
    } catch { toast.error("Failed"); }
  }

  async function cancelMembership(m: MembershipMember) {
    if (!confirm(`Cancel ${m.client.name}'s ${m.plan.name} membership?`)) return;
    try {
      await api.memberships.cancel(bizId!, m.id);
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, status: "CANCELLED" } : x));
      toast.success("Membership cancelled");
    } catch { toast.error("Failed to cancel"); }
  }

  const activeMembers = members.filter(m => m.status === "ACTIVE");
  const monthlyRevenue = activeMembers.reduce((s, m) => s + m.plan.priceMonthly, 0);

  if (!bizId) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Crown className="w-6 h-6 text-amber-500" /> Memberships</h1>
          <p className="text-sm text-gray-500 mt-1">Recurring monthly plans for your best clients.</p>
        </div>
        {tab === "plans" && <Button onClick={() => setShowPlanForm(s => !s)} className="gap-2"><Plus className="w-4 h-4" /> New plan</Button>}
      </div>

      {activeMembers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-xs text-amber-600 font-medium">Active members</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{activeMembers.length}</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
            <p className="text-xs text-green-600 font-medium">Monthly recurring</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{formatPrice(monthlyRevenue)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["plans", "members"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{t}</button>
        ))}
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">Loading…</div> : tab === "plans" ? (
        <div className="space-y-4">
          {showPlanForm && (
            <form onSubmit={createPlan} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <h2 className="font-semibold text-gray-900">New membership plan</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Plan name</label>
                  <Input placeholder="e.g. Monthly Unlimited" value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Monthly price ($)</label>
                  <Input type="number" min={1} step="0.01" placeholder="79.00" value={planForm.priceMonthly} onChange={e => setPlanForm(p => ({ ...p, priceMonthly: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Description (optional)</label>
                  <Input placeholder="e.g. Unlimited haircuts + 10% off products" value={planForm.description} onChange={e => setPlanForm(p => ({ ...p, description: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create plan</Button>
                <Button type="button" variant="outline" onClick={() => setShowPlanForm(false)}>Cancel</Button>
              </div>
            </form>
          )}
          {plans.length === 0 && !showPlanForm ? (
            <div className="text-center py-16 text-gray-400">
              <Crown className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No plans yet</p>
              <p className="text-sm mt-1">Create a monthly plan and enroll clients to generate recurring revenue.</p>
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
                    <p className="text-xs text-gray-500 mt-0.5">{formatPrice(plan.priceMonthly)}/mo{plan.description ? ` · ${plan.description}` : ""}</p>
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
          {members.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No members yet</p>
              <p className="text-sm mt-1">Enroll clients from their profile page.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 shadow-sm">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900">{m.client.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${m.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{m.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{m.plan.name} · {formatPrice(m.plan.priceMonthly)}/mo</p>
                    {m.client.email && <p className="text-xs text-gray-400">{m.client.email}</p>}
                  </div>
                  {m.status === "ACTIVE" && (
                    <button onClick={() => cancelMembership(m)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
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
