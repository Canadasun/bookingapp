"use client";

import { useEffect, useState } from "react";
import {
  Activity, Server, Database, MessageSquare,
  ShieldCheck, Globe, Cpu, Zap, Settings2,
  AlertTriangle, CheckCircle2, Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface HealthMetric {
  name: string;
  value: string;
  status: "HEALTHY" | "WARNING" | "CRITICAL";
}

export default function SystemControl() {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/proxy/admin/health")
      .then(res => res.json())
      .then(setMetrics)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">System Integrity</h2>
        <p className="text-sm text-gray-500 mt-1">Infrastructure monitoring and global configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Health Monitors */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? <LoadingSpinner /> : metrics.map(m => (
              <Card key={m.name} className="border-gray-100 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      m.status === "HEALTHY" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                    }`}>
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{m.name}</p>
                      <p className="text-lg font-bold text-gray-900 leading-none mt-0.5">{m.value}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
                    m.status === "HEALTHY" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  }`}>
                    {m.status === "HEALTHY" ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    {m.status}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-gray-100">
            <CardHeader className="border-b border-gray-50">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" /> Premium Tier Feature Flags
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-50">
                {[
                  { id: "ai_rebooking", label: "AI Rebooking Assistant", desc: "Predictive scheduling for churn prevention" },
                  { id: "sms_marketing", label: "Bulk SMS Marketing", desc: "Promotional blast campaigns for PRO users" },
                  { id: "inventory", label: "Advanced Inventory", desc: "Back-bar and retail product tracking" },
                ].map(flag => (
                  <div key={flag.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{flag.label}</p>
                      <p className="text-xs text-gray-400">{flag.desc}</p>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Global Config */}
        <div className="space-y-6">
          <Card className="border-gray-100 sticky top-24">
            <CardHeader className="border-b border-gray-50 bg-gray-50/50">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-gray-600" /> Global Boundaries
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Max Staff (FREE)</label>
                <Input type="number" defaultValue={2} className="bg-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Platform Commission %</label>
                <Input type="number" defaultValue={2.5} className="bg-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SMS Gateway Cost ($)</label>
                <Input type="number" defaultValue={0.015} className="bg-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Base Currency</label>
                <select className="w-full h-10 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>USD - US Dollar</option>
                  <option>GBP - British Pound</option>
                  <option>EUR - Euro</option>
                </select>
              </div>
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold text-xs uppercase tracking-widest mt-2">
                Save Global Config
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
