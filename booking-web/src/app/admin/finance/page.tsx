"use client";

import { useEffect, useState } from "react";
import {
  DollarSign, ArrowUpRight, ArrowDownRight, Search,
  Filter, Download, CheckCircle2, AlertCircle, Clock,
  CreditCard, Wallet, Banknote
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { formatPrice } from "@/lib/utils";

interface Transaction {
  id: string;
  type: string;
  amountCents: number;
  currency: string;
  status: string;
  provider: string;
  createdAt: string;
  business?: { name: string };
}

export default function FinancePanel() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/proxy/admin/transactions")
      .then(res => res.json())
      .then(setTransactions)
      .finally(() => setLoading(false));
  }, []);

  const totalEscrow = 1245080; // Mock data for now
  const pendingPayouts = 450200;

  const filtered = transactions.filter(t =>
    t.id.toLowerCase().includes(search.toLowerCase()) ||
    t.business?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Financial Settlements</h2>
        <p className="text-sm text-gray-500 mt-1">Platform revenue and payout infrastructure</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-indigo-600 text-white border-0 shadow-lg shadow-indigo-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-white/10 rounded-lg"><Wallet className="w-5 h-5 text-white" /></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">Escrow Balance</span>
            </div>
            <p className="text-3xl font-bold mt-4">{formatPrice(totalEscrow)}</p>
            <p className="text-xs text-indigo-100 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Processing for split
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-amber-50 rounded-lg"><Banknote className="w-5 h-5 text-amber-600" /></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pending Payouts</span>
            </div>
            <p className="text-3xl font-bold mt-4 text-gray-900">{formatPrice(pendingPayouts)}</p>
            <p className="text-xs text-emerald-600 mt-1 font-bold">Scheduled for Friday</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-red-50 rounded-lg"><AlertCircle className="w-5 h-5 text-red-600" /></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Active Disputes</span>
            </div>
            <p className="text-3xl font-bold mt-4 text-gray-900">4</p>
            <p className="text-xs text-red-600 mt-1 font-bold">Action required</p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Payout Ledger</h3>
          <div className="flex gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search ledger..." className="pl-9 h-9 bg-white" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" className="bg-white gap-2"><Download className="w-4 h-4" /> Export</Button>
          </div>
        </div>

        <Card className="overflow-hidden border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Transaction ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Tenant</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Type</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={6} className="py-12 text-center"><LoadingSpinner /></td></tr>
                ) : filtered.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-[10px] text-gray-400">{t.id}</td>
                    <td className="px-6 py-4 font-bold text-sm text-gray-700">{t.business?.name || "Platform"}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-500">
                        {t.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-sm text-gray-900">{formatPrice(t.amountCents)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[10px] uppercase">
                        <CheckCircle2 className="w-3 h-3" /> {t.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
