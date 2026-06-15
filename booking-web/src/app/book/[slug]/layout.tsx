import type { Metadata } from "next";
import { apiBase } from "@/lib/server-api";

const API = apiBase();

interface BizPublic {
  name?: string;
  slug?: string;
  address?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
}

async function getBusiness(slug: string): Promise<BizPublic | null> {
  try {
    const res = await fetch(`${API}/businesses/slug/${slug}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as BizPublic;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const biz = await getBusiness(slug);
  const name = biz?.name ?? "an appointment";
  const title = name === "an appointment" ? "Book an appointment" : `Book at ${name}`;
  const description = `Book an appointment online at ${name}.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

const SITE_URL = "https://www.pulseappointments.com";

export default async function BookLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const biz = await getBusiness(slug);

  const jsonLd = biz?.name
    ? {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: biz.name,
        url: `${SITE_URL}/book/${slug}`,
        ...(biz.address ? { address: biz.address } : {}),
        ...(biz.phone ? { telephone: biz.phone } : {}),
        ...(biz.websiteUrl ? { sameAs: [biz.websiteUrl] } : {}),
        ...(biz.logoUrl ? { image: biz.logoUrl } : {}),
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
