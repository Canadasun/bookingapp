import type { MetadataRoute } from "next";

const SITE_URL = "https://www.pulseappointments.com";
const API_URL = (
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001"
).replace(/\/+$/, "").replace(/\/api$/, "");

// Update this date whenever meaningful static content changes are deployed.
const CONTENT_DATE = new Date("2026-06-15");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,             lastModified: CONTENT_DATE, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/pricing`,      lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/register`,     lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/login`,        lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/book`,         lastModified: CONTENT_DATE, changeFrequency: "daily",   priority: 0.7 },
    { url: `${SITE_URL}/support`,      lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/terms`,        lastModified: CONTENT_DATE, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/privacy`,      lastModified: CONTENT_DATE, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/accessibility`,lastModified: CONTENT_DATE, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/status`,       lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.3 },
  ];

  // Dynamically include all public (non-suspended) business booking pages.
  const businessRoutes: MetadataRoute.Sitemap = await fetch(
    `${API_URL}/api/businesses/public-slugs`,
    { next: { revalidate: 3600 } }, // cache for 1 hour
  )
    .then((r) => r.json() as Promise<{ slug: string; updatedAt: string }[]>)
    .then((slugs) =>
      slugs.map(({ slug, updatedAt }) => ({
        url: `${SITE_URL}/book/${slug}`,
        lastModified: new Date(updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    )
    .catch(() => []); // if API is unreachable, degrade gracefully

  return [...staticRoutes, ...businessRoutes];
}
