import Link from "next/link";
import { Calendar, ArrowLeft } from "lucide-react";

export default function BookingNotFound() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-6">
        <Calendar className="w-7 h-7 text-gray-400" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking page not found</h1>
      <p className="text-gray-500 max-w-sm mb-8">
        This booking page may have been paused, removed, or the link may be incorrect. Check with the business for their current booking link.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Go to Pulse home
      </Link>
    </div>
  );
}
