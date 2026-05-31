"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, Users, Calendar, Activity,
  ArrowUpRight, ArrowDownRight, DollarSign,
  Building2, Percent, Zap
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { formatPrice } from "@/lib/utils";

interface Metrics {
  revenue: { total: number; subscription: number; commission: number; fees: number };
  tenants: { total: number; active: number; suspended: number };
  velocity: { completed: number; noShowRate: number };
}

function MetricCard({ label, value, subValue, icon: Icon, color, trend }: any) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className={`p-2.5 rounded-xl bg-${color}-50 text-${color}-600`}>
            <Icon className="w-5 h-5" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-bold ${trend > 0 ? "text-emerald-600" : "text-red-600"}`}>
              {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
        </div>
        {subValue && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{subValue.label}</span>
            <span className="text-xs font-semibold text-gray-700">{subValue.value}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminOverview() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("week");

  useEffect(() => {
    setLoading(true);
    fetch(`/proxy/admin/metrics?timeframe=${timeframe}`)
      .then(res => res.json())
      .then(setMetrics)
      .finally(() => setLoading(false));
  }, [timeframe]);

  if (loading) return <LoadingSpinner />;
  if (!metrics) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">System Performance</h2>
          <p className="text-sm text-gray-500 mt-1">Aggregate health and revenue metrics</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {["today", "week", "month"].map((t) => (
            <button key={t} onClick={() => setTimeframe(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                timeframe === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* High-Level Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Platform Revenue"
          value={formatPrice(metrics.revenue.total)}
          icon={DollarSign}
          color="indigo"
          trend={12}
          subValue={{ label: "Commission", value: formatPrice(metrics.revenue.commission) }}
        />
        <MetricCard
          label="Active Tenants"
          value={metrics.tenants.active}
          icon={Building2}
          color="violet"
          subValue={{ label: "Total Onboarded", value: metrics.tenants.total }}
        />
        <MetricCard
          label="Booking Velocity"
          value={metrics.velocity.completed}
          icon={Zap}
          color="amber"
          trend={8}
          subValue={{ label: "Completed Appointments", value: metrics.velocity.completed }}
        />
        <MetricCard
          label="No-Show Rate"
          value={`${metrics.velocity.noShowRate.toFixed(1)}%`}
          icon={Percent}
          color="red"
          subValue={{ label: "Platform Avg", value: "4.2%" }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Breakdown */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6">Revenue Mix</h3>
            <div className="space-y-6">
              {[
                { label: "Subscription Fees", value: metrics.revenue.subscription, color: "bg-indigo-500" },
                { label: "Commission Cuts", value: metrics.revenue.commission, color: "bg-violet-500" },
                { label: "Processing Fees", value: metrics.revenue.fees, color: "bg-emerald-500" },
              ].map((item) => {
                const pct = metrics.revenue.total > 0 ? (item.value / metrics.revenue.total) * 100 : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      <span className="text-sm font-bold text-gray-900">{formatPrice(item.value)}</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tenant Health */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6">Tenant Health</h3>
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="64" cy="64" r="58" fill="transparent" stroke="#F3F4F6" strokeWidth="8" />
                  <circle cx="64" cy="64" r="58" fill="transparent" stroke="#6366F1" strokeWidth="8"
                    strokeDasharray={364} strokeDashoffset={364 * (1 - metrics.tenants.active / metrics.tenants.total)}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">
                    {Math.round((metrics.tenants.active / metrics.tenants.total) * 100)}%
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Active</span>
                </div>
              </div>
              <div className="mt-8 w-full space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Churn Rate</span>
                  <span className="text-red-600 font-bold">2.4%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Trial Expirations (7d)</span>
                  <span className="text-amber-600 font-bold">14</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
