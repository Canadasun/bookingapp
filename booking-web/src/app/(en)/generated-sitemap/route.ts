import { LOCALIZED_PATHS } from "@/lib/hreflang";

const SITE_URL = "https://www.pulseappointments.com";
const CONTENT_DATE = new Date().toISOString();

type SitemapRoute = {
  url: string;
  lastModified: string;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
  alternates?: { en: string; fr: string };
};

const RAW_API_URL = (
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.RAILWAY_SERVICE_BOOKINGAPP_URL ??
  "http://localhost:3001"
).replace(/\/+$/, "").replace(/\/api$/, "");
const API_URL = /^https?:\/\//i.test(RAW_API_URL) ? RAW_API_URL : `https://${RAW_API_URL}`;
const RAW_PUBLIC_API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.RAILWAY_SERVICE_BOOKINGAPP_URL ??
  "http://localhost:3001"
).replace(/\/+$/, "").replace(/\/api$/, "");
const PUBLIC_API_URL = /^https?:\/\//i.test(RAW_PUBLIC_API_URL) ? RAW_PUBLIC_API_URL : `https://${RAW_PUBLIC_API_URL}`;
const API_CANDIDATES = Array.from(new Set([API_URL, PUBLIC_API_URL]));

type RouteConfig = Pick<SitemapRoute, "changeFrequency" | "priority">;

// LOCALIZED_PATHS owns bilingual route discovery. This object only overrides
// ranking/crawl hints; adding a translated page never requires a second sitemap
// edit. Non-localized public utility routes are listed separately below.
const DEFAULT_ROUTE: RouteConfig = { changeFrequency: "monthly", priority: 0.7 };
const ROUTE_OVERRIDES: Record<string, RouteConfig> = {
  "/": { changeFrequency: "weekly", priority: 1 },
  "/pricing": { changeFrequency: "monthly", priority: 0.9 },
  "/blog": { changeFrequency: "weekly", priority: 0.8 },
  "/changelog": { changeFrequency: "weekly", priority: 0.5 },
  "/terms": { changeFrequency: "yearly", priority: 0.3 },
  "/privacy": { changeFrequency: "yearly", priority: 0.3 },
  "/canadian-privacy": { changeFrequency: "yearly", priority: 0.5 },
  "/security": { changeFrequency: "yearly", priority: 0.5 },
};
const ENGLISH_ONLY_ROUTES: Record<string, RouteConfig> = {
  "/register": { changeFrequency: "monthly", priority: 0.8 },
  "/login": { changeFrequency: "monthly", priority: 0.6 },
  "/book": { changeFrequency: "daily", priority: 0.7 },
};

const staticRoutes: SitemapRoute[] = [
  ...Array.from(LOCALIZED_PATHS, (path) => [path, ROUTE_OVERRIDES[path] ?? DEFAULT_ROUTE] as const),
  ...Object.entries(ENGLISH_ONLY_ROUTES),
].flatMap(([logicalPath, config]) => {
  const suffix = logicalPath === "/" ? "" : logicalPath;
  const en = `${SITE_URL}${suffix}`;
  const fr = `${SITE_URL}/fr${suffix}`;
  const base = {
    lastModified: CONTENT_DATE,
    ...config,
  };
  if (!LOCALIZED_PATHS.has(logicalPath)) return [{ ...base, url: en }];
  const alternates = { en, fr };
  return [
    { ...base, url: en, alternates },
    { ...base, url: fr, alternates },
  ];
});

type PublicSlug = {
  slug: string;
  updatedAt: string;
  locations?: { slug: string }[];
};

async function fetchPublicSlugs(): Promise<PublicSlug[]> {
  for (const apiUrl of API_CANDIDATES) {
    try {
      const response = await fetch(`${apiUrl}/api/businesses/public-slugs`, { cache: "no-store" });
      if (!response.ok) continue;
      const slugs = await response.json();
      if (Array.isArray(slugs)) return slugs as PublicSlug[];
    } catch {
      // Try the next configured API URL.
    }
  }
  return [];
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderUrl(route: SitemapRoute) {
  return [
    "<url>",
    `<loc>${escapeXml(route.url)}</loc>`,
    ...(route.alternates ? [
      `<xhtml:link rel="alternate" hreflang="en-CA" href="${escapeXml(route.alternates.en)}"/>`,
      `<xhtml:link rel="alternate" hreflang="fr-CA" href="${escapeXml(route.alternates.fr)}"/>`,
      `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(route.alternates.en)}"/>`,
    ] : []),
    `<lastmod>${route.lastModified}</lastmod>`,
    `<changefreq>${route.changeFrequency}</changefreq>`,
    `<priority>${route.priority}</priority>`,
    "</url>",
  ].join("");
}

export async function GET() {
  const businessRoutes = (await fetchPublicSlugs()).flatMap(({ slug, updatedAt, locations = [] }) => {
    const lastModified = new Date(updatedAt).toISOString();
    return [
      { url: `${SITE_URL}/book/${slug}`, lastModified, changeFrequency: "weekly" as const, priority: 0.8 },
      { url: `${SITE_URL}/bio/${slug}`, lastModified, changeFrequency: "weekly" as const, priority: 0.7 },
      ...locations.map((location) => ({
        url: `${SITE_URL}/book/${slug}/${location.slug}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  });

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...[...staticRoutes, ...businessRoutes].map(renderUrl),
    "</urlset>",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
