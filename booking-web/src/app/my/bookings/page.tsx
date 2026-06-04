"use client";

import Link from "next/link";
import { CalendarSearch } from "lucide-react";

export default function MyBookingsEntryPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] px-5 py-10">
      <div className="mx-auto max-w-lg rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
          <CalendarSearch className="h-6 w-6 text-violet-700" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Find your bookings</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Booking lookup is business-specific. Use the manage link in your email, the business booking page, or sign in to see bookings tied to your verified email.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/my/login" className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700">
            Client sign in
          </Link>
          <Link href="/book" className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Booking link help
          </Link>
        </div>
      </div>
    </div>
  );
}
