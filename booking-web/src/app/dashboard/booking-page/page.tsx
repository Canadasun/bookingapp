"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – react-qr-code ships types but they're not resolved via "exports"; works fine at runtime
import QRCode from "react-qr-code";
import { Globe, Copy, Check, ExternalLink, Palette, Braces, ChevronRight } from "lucide-react";
import { api, type Business } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function BookingPageHub() {
  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";
  const [biz, setBiz] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoadError("");
    setLoading(true);
    try {
      setBiz(await api.business.get(bizId));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bookingUrl = `${origin}/book/${biz?.slug || biz?.id || ""}`;

  function copyLink() {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-violet-600" />
          <h1 className="text-xl font-bold text-gray-900">Booking Page</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">Your public storefront — share the link so clients can book themselves, 24/7.</p>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      ) : (
        <div className="space-y-4">
          {/* Live link + share */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Your booking link</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">
              <code className="text-sm text-violet-600 flex-1 truncate">{bookingUrl}</code>
              <button type="button" onClick={copyLink} aria-label="Copy booking link" className="shrink-0 text-gray-500 hover:text-violet-700">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
                <ExternalLink className="w-4 h-4" /> Preview page
              </a>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Book an appointment with me: ${bookingUrl}`)}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">WhatsApp</a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(bookingUrl)}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Facebook</a>
              <a href={`mailto:?subject=Book an appointment&body=You can book an appointment with me here: ${bookingUrl}`}
                className="inline-flex items-center rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Email</a>
            </div>
          </div>

          {/* QR */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">QR code</p>
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-gray-100 p-3 bg-white">
                <QRCode value={bookingUrl} size={120} />
              </div>
              <p className="text-sm text-gray-500">Print it for your front desk or add it to flyers — clients scan to book instantly.</p>
            </div>
          </div>

          {/* Deeper customization → existing Settings editors */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Link href="/dashboard/settings?tab=branding" className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2.5">
                <Palette className="w-4 h-4 text-violet-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">Branding</p>
                  <p className="text-xs text-gray-400 mt-0.5">Colors, fonts, page style</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </Link>
            <Link href="/dashboard/settings?tab=online" className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2.5">
                <Braces className="w-4 h-4 text-violet-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">Embed &amp; advanced</p>
                  <p className="text-xs text-gray-400 mt-0.5">Website embed snippet, bio link</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
