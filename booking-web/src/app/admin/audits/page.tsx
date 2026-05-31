"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Search, Filter, Clock, User, HardDrive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface Audit {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  createdAt: string;
  changes: any;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock or fetch from a future endpoint
    setLogs([
      { id: "1", entityType: "BUSINESS", entityId: "biz_1", action: "SUSPEND", userId: "admin_1", createdAt: new Date().toISOString(), changes: { suspended: true } },
      { id: "2", entityType: "PLAN", entityId: "biz_2", action: "UPGRADE", userId: "admin_1", createdAt: new Date(Date.now() - 3600000).toISOString(), changes: { plan: "PRO" } },
      { id: "3", entityType: "CONFIG", entityId: "system", action: "UPDATE", userId: "admin_1", createdAt: new Date(Date.now() - 86400000).toISOString(), changes: { max_staff: 5 } },
    ]);
    setLoading(false);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Technical Auditing</h2>
        <p className="text-sm text-gray-500 mt-1">Platform-wide oversight and security logs</p>
      </div>

      <Card className="border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Timestamp</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Actor</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Entity</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Action</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center"><LoadingSpinner /></td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[10px]">AD</div>
                      <span className="text-xs font-bold text-gray-700">System Admin</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-3 h-3 text-gray-400" />
                      <span className="text-xs font-medium text-gray-600">{log.entityType} ({log.entityId.slice(0, 8)})</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      log.action === "SUSPEND" ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600"
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-[10px] bg-gray-50 p-1 rounded text-gray-400">{JSON.stringify(log.changes)}</code>
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
