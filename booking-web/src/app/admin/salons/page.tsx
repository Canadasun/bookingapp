"use client";

import { useEffect, useState } from "react";
import {
  Search, ShieldAlert, ShieldCheck, MoreHorizontal,
  ExternalLink, UserPlus, Ban, Trash2, CheckCircle2,
  Calendar, Users, Info
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { formatPrice } from "@/lib/utils";

interface Salon {
  id: string;
  name: string;
  slug: string;
  email: string;
  plan: string;
  suspended: boolean;
  createdAt: string;
  _count: { staff: number; appointments: number };
}

export default function SalonRegistry() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    loadSalons();
  }, []);

  async function loadSalons() {
    setLoading(true);
    fetch("/proxy/admin/salons")
      .then(res => res.json())
      .then(setSalons)
      .finally(() => setLoading(false));
  }

  async function toggleSuspend(salon: Salon) {
    setActing(salon.id);
    try {
      const res = await fetch(`/proxy/admin/salons/${salon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: !salon.suspended }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(salon.suspended ? "Salon unsuspended" : "Salon suspended");
      loadSalons();
    } catch (e) {
      toast.error("Operation failed");
    } finally {
      setActing(null);
    }
  }

  async function impersonate(salon: Salon) {
    setActing(salon.id);
    try {
      const res = await fetch(`/proxy/admin/salons/${salon.id}/impersonate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to impersonate");

      // Set cookies for impersonation
      document.cookie = `booking_token=${data.accessToken}; path=/`;
      document.cookie = `booking_user=${btoa(JSON.stringify(data.user))}; path=/`;

      toast.success(`Now logged in as ${salon.name} owner`);
      window.location.href = "/dashboard";
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActing(null);
    }
  }

  const filtered = salons.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Salon Registry</h2>
          <p className="text-sm text-gray-500 mt-1">Manage platform tenants and subscriptions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search salons..."
              className="pl-9 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2 bg-white">
            <Info className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-gray-100 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Salon / ID</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Activity</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center"><LoadingSpinner /></td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 italic">No salons found</td>
                </tr>
              ) : filtered.map((salon) => (
                <tr key={salon.id} className={`hover:bg-gray-50/50 transition-colors ${salon.suspended ? "opacity-60" : ""}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                        {salon.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{salon.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono truncate">{salon.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${
                      salon.plan === "PRO" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                      salon.plan === "BASIC" ? "bg-indigo-50 text-indigo-600 border border-indigo-100" :
                      "bg-gray-100 text-gray-500 border border-gray-200"
                    }`}>
                      {salon.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                      <div className="flex items-center gap-1.5" title="Staff count">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        {salon._count.staff}
                      </div>
                      <div className="flex items-center gap-1.5" title="Total appointments">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {salon._count.appointments}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {salon.suspended ? (
                      <div className="flex items-center gap-1.5 text-red-600 font-bold text-[10px] uppercase tracking-wider">
                        <ShieldAlert className="w-3.5 h-3.5" /> Suspended
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[10px] uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-gray-500 font-medium">{new Date(salon.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                        title="Impersonate Owner"
                        disabled={acting === salon.id}
                        onClick={() => impersonate(salon)}
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 ${salon.suspended ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" : "text-amber-600 hover:text-amber-700 hover:bg-amber-50"}`}
                        title={salon.suspended ? "Unsuspend" : "Suspend"}
                        disabled={acting === salon.id}
                        onClick={() => toggleSuspend(salon)}
                      >
                        {salon.suspended ? <ShieldCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Audit Logs"
                        disabled={acting === salon.id}
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
