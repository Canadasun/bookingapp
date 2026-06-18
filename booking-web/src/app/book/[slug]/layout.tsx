import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiBase } from "@/lib/server-api";

const API = apiBase();

interface BizPublic {
  name?: string;
  slug?: string;
  address?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  averageRating?: number | null;
  reviewCount?: number;
  hours?: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
}

async function getBusiness(slug: string): Promise<BizPublic | null> {
  try {
    const res = await fetch(`${API}/businesses/slug/${slug}`, { next: { revalidate: 300 } });
    if (res.status === 404) return null; // triggers notFound() in layout below
    if (!res.ok) return null;            // other errors: degrade gracefully
    return (await res.json()) as BizPublic;
  } catch {
    return null;
  }
}

const SITE_URL = "https://www.pulseappointments.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const biz = await getBusiness(slug);
  const name = biz?.name ?? "an appointment";
  const title = name === "an appointment" ? "Book an appointment" : `Book at ${name}`;
  const description = `Book an appointment online at ${name}.`;
  const ogImages = biz?.logoUrl ? [{ url: biz.logoUrl }] : [];
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/book/${slug}` },
    openGraph: { title, description, ...(ogImages.length ? { images: ogImages } : {}) },
    twitter: { title, description, card: ogImages.length ? "summary_large_image" : "summary" },
  };
}

export default async function BookLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const biz = await getBusiness(slug);

  // Render the branded not-found page when the slug is unknown or the business
  // is suspended (API returns 404 for both). This replaces the half-rendered
  // client skeleton that showed before when the page.tsx handled the error.
  if (!biz) notFound();

  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const openingHours = (biz?.hours ?? []).map(h => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: DAY_NAMES[h.dayOfWeek],
    opens: h.startTime,
    closes: h.endTime,
  }));

  const jsonLd = biz?.name
    ? {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: biz.name,
        ...(biz.websiteUrl ? { url: biz.websiteUrl } : {}),
        ...(biz.address ? { address: biz.address } : {}),
        ...(biz.phone ? { telephone: biz.phone } : {}),
        sameAs: [`${SITE_URL}/book/${slug}`],
        ...(biz.logoUrl ? { image: biz.logoUrl } : {}),
        ...(openingHours.length ? { openingHoursSpecification: openingHours } : {}),
        ...(biz.averageRating != null && biz.reviewCount
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: biz.averageRating,
                reviewCount: biz.reviewCount,
                bestRating: 5,
                worstRating: 1,
              },
            }
          : {}),
      }
    : null;

  // JSON.stringify does not escape <, >, /, or & — any of these in user-controlled
  // fields (name, address, phone) would close the <script> tag and allow XSS.
  const safeJsonLd = jsonLd
    ? JSON.stringify(jsonLd)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/\//g, "\\u002f")
        .replace(/&/g, "\\u0026")
    : null;

  return (
    <>
      {safeJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd }}
        />
      )}
      {children}
    </>
  );
}
