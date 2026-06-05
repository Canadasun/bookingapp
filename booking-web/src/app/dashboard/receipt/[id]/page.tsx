"use client";

import { useEffect, useState, use } from "react";
import { format } from "date-fns";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api, Appointment, Payment, Business } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = getUser();
  const bizId = user?.businessId ?? "";
  const [apt, setApt] = useState<Appointment | null>(null);
  const [biz, setBiz] = useState<Business | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bizId) { setLoading(false); return; }
    Promise.all([
      api.appointments.getOne(bizId, id),
      api.business.get(bizId).catch(() => null),
      api.payments.list().catch(() => [] as Payment[]),
    ]).then(([a, b, p]) => {
      setApt(a); setBiz(b);
      setPayments(p.filter((x) => x.appointment?.id === id));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [bizId, id]);

  if (loading) return <LoadingSpinner />;
  if (!apt) return <p className="text-center text-gray-400 py-12">Receipt not found.</p>;

  const currency = (biz?.currency ?? "CAD") as "CAD" | "USD";
  const money = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(c / 100);
  const rate = biz?.taxRatePercent ?? 0;
  const subtotal = apt.service.priceCents;
  const taxCents = Math.round(subtotal * (rate / 100));
  const total = subtotal + taxCents;
  const tipsCollected = payments.reduce((s, p) => s + (p.status === "SUCCEEDED" ? (p.tipCents ?? 0) : 0), 0);
  const paid = payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + (p.amountCents - (p.refundedCents ?? 0)), 0);
  const alsoIncludes = (apt.notes ?? "").includes("Also includes:")
    ? (apt.notes ?? "").split("Also includes:")[1]?.split("|")[0]?.trim()
    : "";

  return (
    <div className="max-w-2xl mx-auto">
      {/* Controls — hidden when printing */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link href="/dashboard/appointments" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <Button size="sm" onClick={() => window.print()} className="gap-1.5"><Printer className="w-4 h-4" /> Print / Save PDF</Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 print:shadow-none print:border-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {biz?.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={biz.logoUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
              : <div className="w-12 h-12 rounded-xl bg-violet-600" />}
            <div>
              <p className="text-lg font-bold text-gray-900">{biz?.name ?? "Business"}</p>
              {biz?.email && <p className="text-xs text-gray-400">{biz.email}</p>}
              {biz?.phone && <p className="text-xs text-gray-400">{biz.phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase tracking-wide text-gray-400">Receipt</p>
            <p className="text-xs text-gray-500 mt-1 font-mono">#{apt.id.slice(-8).toUpperCase()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{format(new Date(apt.startsAt), "MMM d, yyyy")}</p>
          </div>
        </div>

        {/* Bill to */}
        <div className="py-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Billed to</p>
            <p className="font-medium text-gray-900">{apt.client.name}</p>
            <p className="text-xs text-gray-500">{apt.client.email}</p>
            {apt.client.phone && <p className="text-xs text-gray-500">{apt.client.phone}</p>}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Appointment</p>
            <p className="text-gray-700">{format(new Date(apt.startsAt), "EEE, MMM d · HH:mm")}</p>
            <p className="text-xs text-gray-500">with {apt.staff.user.name}</p>
          </div>
        </div>

        {/* Line items */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex justify-between text-sm py-2">
            <div>
              <p className="text-gray-800">{apt.service.name}</p>
              {alsoIncludes && <p className="text-xs text-gray-400">+ {alsoIncludes}</p>}
            </div>
            <p className="font-medium text-gray-900">{money(subtotal)}</p>
          </div>
        </div>

        {/* Totals */}
        <div className="border-t border-gray-100 mt-2 pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {rate > 0 && <div className="flex justify-between text-gray-500"><span>Tax ({rate}%)</span><span>{money(taxCents)}</span></div>}
          {tipsCollected > 0 && <div className="flex justify-between text-gray-500"><span>Tip</span><span>{money(tipsCollected)}</span></div>}
          <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-100">
            <span>Total</span><span>{money(total + tipsCollected)}</span>
          </div>
          {paid > 0 && (
            <>
              <div className="flex justify-between text-emerald-600"><span>Paid</span><span>{money(paid)}</span></div>
              <div className="flex justify-between font-semibold text-gray-700">
                <span>Balance</span><span>{money(Math.max(0, total + tipsCollected - paid))}</span>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-300 mt-8">Thank you for your business · Powered by Pulse</p>
      </div>
    </div>
  );
}
