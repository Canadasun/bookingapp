import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Globe, Star, Calendar } from "lucide-react";

interface PublicBusiness {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  address?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  currency: string;
  reviewCount: number;
  averageRating: number | null;
  locations: { id: string; name: string; address?: string | null }[];
}

interface PublicService {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceCents: number;
  priceType: string;
}

async function getBusiness(slug: string): Promise<PublicBusiness | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${apiUrl}/businesses/slug/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json() as Promise<PublicBusiness>;
  } catch {
    return null;
  }
}

async function getServices(businessId: string): Promise<PublicService[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${apiUrl}/businesses/${businessId}/services/public`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json() as { data?: PublicService[] } | PublicService[];
    return Array.isArray(data) ? data : (data.data ?? []);
  } catch {
    return [];
  }
}

function formatPrice(cents: number, priceType: string, currency: string) {
  const amount = new Intl.NumberFormat("en-CA", { style: "currency", currency: currency || "CAD", maximumFractionDigits: 0 }).format(cents / 100);
  if (priceType === "STARTING_AT") return `From ${amount}`;
  if (priceType === "PER_HOUR") return `${amount}/hr`;
  return amount;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const biz = await getBusiness(slug);
  if (!biz) return { title: "Business Not Found | Pulse Appointments" };
  return {
    title: `Book with ${biz.name} | Pulse Appointments`,
    description: `Book an appointment with ${biz.name}. View services and book online instantly.`,
    openGraph: {
      title: `Book with ${biz.name}`,
      description: `Book an appointment with ${biz.name}. View services and book online instantly.`,
      images: biz.logoUrl ? [{ url: biz.logoUrl }] : [],
    },
  };
}

export default async function BioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [biz, services] = await Promise.all([getBusiness(slug), (getBusiness(slug).then((b) => b ? getServices(b.id) : []))]);

  if (!biz) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Business not found.</p>
          <Link href="/" className="text-violet-600 hover:underline text-sm">Back to Pulse</Link>
        </div>
      </div>
    );
  }

  const topServices = services.slice(0, 6);
  const bookingUrl = `/book/${biz.slug}`;

  const socialLinks = [
    biz.instagramUrl && { href: biz.instagramUrl, label: "Instagram", icon: "IG" },
    biz.facebookUrl && { href: biz.facebookUrl, label: "Facebook", icon: "FB" },
    biz.tiktokUrl && { href: biz.tiktokUrl, label: "TikTok", icon: "TT" },
    biz.websiteUrl && { href: biz.websiteUrl, label: "Website", icon: "WEB" },
  ].filter(Boolean) as { href: string; label: string; icon: string }[];

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white">
      <div className="max-w-sm mx-auto px-4 py-10">

        {/* Logo / avatar */}
        <div className="flex flex-col items-center text-center mb-6">
          {biz.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={biz.logoUrl} alt={biz.name} className="w-24 h-24 rounded-full object-cover shadow-md mb-4" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-violet-600 flex items-center justify-center shadow-md mb-4">
              <span className="text-3xl font-bold text-white">{biz.name.charAt(0)}</span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900">{biz.name}</h1>
          {biz.averageRating && (
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-sm font-semibold text-slate-700">{biz.averageRating}</span>
              <span className="text-xs text-slate-400">({biz.reviewCount} reviews)</span>
            </div>
          )}
          {(biz.address || (biz.locations.length > 0 && biz.locations[0].address)) && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-500">
              <MapPin className="w-3.5 h-3.5" />
              <span>{biz.address ?? biz.locations[0].address}</span>
            </div>
          )}
        </div>

        {/* Book Now CTA */}
        <Link
          href={bookingUrl}
          className="flex items-center justify-center gap-2 w-full bg-violet-600 text-white font-semibold text-base rounded-2xl py-3.5 hover:bg-violet-700 transition-colors shadow-sm mb-3"
        >
          <Calendar className="w-5 h-5" />
          Book an appointment
        </Link>

        {/* Services */}
        {topServices.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 pt-4 pb-2">Services</p>
            <div className="divide-y divide-slate-100">
              {topServices.map((svc) => (
                <div key={svc.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 mr-3">
                    <p className="text-sm font-medium text-slate-900 truncate">{svc.name}</p>
                    <p className="text-xs text-slate-400">{formatDuration(svc.durationMinutes)}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-700 shrink-0">
                    {formatPrice(svc.priceCents, svc.priceType, biz.currency)}
                  </p>
                </div>
              ))}
            </div>
            {services.length > 6 && (
              <Link href={bookingUrl} className="block text-center text-xs text-violet-600 font-medium py-3 hover:bg-violet-50 transition-colors">
                View all {services.length} services →
              </Link>
            )}
          </div>
        )}

        {/* Social links */}
        {socialLinks.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {socialLinks.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-violet-300 hover:text-violet-700 transition-colors shadow-sm">
                <Globe className="w-3 h-3" />
                {l.label}
              </a>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          Powered by{" "}
          <Link href="/" className="text-violet-500 hover:underline">Pulse Appointments</Link>
        </p>
      </div>
    </div>
  );
}
