import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiBase } from "@/lib/server-api";

const API = apiBase();
const SITE_URL = "https://www.pulseappointments.com";

type Hours = { dayOfWeek: number; startTime: string; endTime: string };
type PublicBusiness = {
  name: string;
  logoUrl?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  averageRating?: number | null;
  reviewCount?: number;
  locations?: Array<{
    slug?: string | null;
    name: string;
    address?: string | null;
    phone?: string | null;
    hours?: Hours[];
  }>;
};

async function getBranch(businessSlug: string, locationSlug: string) {
  try {
    const response = await fetch(`${API}/businesses/slug/${businessSlug}`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const business = (await response.json()) as PublicBusiness;
    const location = business.locations?.find((item) => item.slug === locationSlug);
    return location ? { business, location } : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locationSlug: string }>;
}): Promise<Metadata> {
  const { slug, locationSlug } = await params;
  const result = await getBranch(slug, locationSlug);
  if (!result) return {};

  const { business, location } = result;
  const title = `Book at ${business.name} — ${location.name}`;
  const description = `Book an appointment online at ${business.name}, ${location.name}.`;
  const canonical = `${SITE_URL}/book/${slug}/${locationSlug}`;
  const images = business.logoUrl ? [{ url: business.logoUrl }] : [];

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      locale: "en_CA",
      alternateLocale: ["fr_CA"],
      ...(images.length ? { images } : {}),
    },
    twitter: { title, description, card: images.length ? "summary_large_image" : "summary" },
  };
}

export default async function LocationBookLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; locationSlug: string }>;
}) {
  const { slug, locationSlug } = await params;
  const result = await getBranch(slug, locationSlug);
  if (!result) notFound();

  const { business, location } = result;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const canonical = `${SITE_URL}/book/${slug}/${locationSlug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: `${business.name} — ${location.name}`,
    url: canonical,
    ...(location.address ? { address: location.address } : {}),
    ...(location.phone ?? business.phone ? { telephone: location.phone ?? business.phone } : {}),
    ...(business.logoUrl ? { image: business.logoUrl } : {}),
    ...(business.websiteUrl ? { sameAs: [business.websiteUrl] } : {}),
    openingHoursSpecification: (location.hours ?? []).map((hour) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: dayNames[hour.dayOfWeek],
      opens: hour.startTime,
      closes: hour.endTime,
    })),
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${canonical}{?lang}`,
        inLanguage: ["en-CA", "fr-CA"],
      },
    },
    ...(business.averageRating != null && business.reviewCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: business.averageRating,
            reviewCount: business.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
  const safeJsonLd = JSON.stringify(jsonLd)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\//g, "\\u002f")
    .replace(/&/g, "\\u0026");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd }} />
      {children}
    </>
  );
}
