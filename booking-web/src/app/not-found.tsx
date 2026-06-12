import Link from "next/link";
import { Calendar, Compass } from "lucide-react";

export const metadata = { title: "Page Not Found — Pulse" };

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-5">
          <Compass className="w-7 h-7 text-violet-500" />
        </div>
        <p className="text-sm font-semibold text-violet-600 uppercase tracking-widest mb-2">404</p>
        <h1 className="text-xl font-bold text-gray-900 mb-3">Page Not Found</h1>
        <p className="text-sm text-gray-500 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
          >
            <Calendar className="w-4 h-4" /> Go to Pulse
          </Link>
          <Link
            href="/support"
            className="inline-flex items-center justify-center px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            Get help
          </Link>
        </div>
      </div>
    </div>
  );
}
