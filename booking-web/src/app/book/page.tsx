"use client";

import Link from "next/link";
import { Calendar, Building2, ShieldCheck } from "lucide-react";

export default function BookEntryPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] px-5 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Book an appointment</h1>
            <p className="text-sm text-gray-500">Use the booking link from the business you want to visit.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex gap-3">
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Every business has its own booking page</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">
                  Services, staff, prices, availability, waitlist, and policies load only from that business-specific link.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">No demo or fallback booking</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">
                  This page does not choose a default business. Open the unique link shared by the business to book or manage an appointment.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Link href="/login" className="block rounded-xl border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Are you a business? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
