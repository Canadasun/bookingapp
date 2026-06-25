const SITE_URL = "https://www.pulseappointments.com";
const CONTENT_DATE = new Date().toISOString();

type SitemapRoute = {
  url: string;
  lastModified: string;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
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

const staticRoutes: SitemapRoute[] = [
  ["/", "weekly", 1.0],
  ["/pricing", "monthly", 0.9],
  ["/demo", "monthly", 0.8],
  ["/reviews", "monthly", 0.7],
  ["/referrals", "monthly", 0.7],
  ["/register", "monthly", 0.8],
  ["/login", "monthly", 0.6],
  ["/book", "daily", 0.7],
  ["/support", "monthly", 0.6],
  ["/about", "monthly", 0.6],
  ["/trust", "monthly", 0.6],
  ["/terms", "yearly", 0.3],
  ["/privacy", "yearly", 0.3],
  ["/accessibility", "yearly", 0.3],
  ["/status", "monthly", 0.3],
  ["/security", "yearly", 0.5],
  ["/canadian-privacy", "yearly", 0.5],
  ["/changelog", "weekly", 0.5],
  ["/compare", "monthly", 0.7],
  ["/compare/pulse-vs-square-appointments", "monthly", 0.8],
  ["/compare/pulse-vs-calendly", "monthly", 0.8],
  ["/compare/pulse-vs-acuity-scheduling", "monthly", 0.8],
  ["/compare/pulse-vs-jane-app", "monthly", 0.8],
  ["/compare/pulse-vs-vagaro", "monthly", 0.8],
  ["/compare/pulse-vs-glossgenius", "monthly", 0.8],
  ["/features", "monthly", 0.8],
  ["/for", "monthly", 0.7],
  ["/for/salons", "monthly", 0.8],
  ["/for/barbers", "monthly", 0.8],
  ["/for/lash-techs", "monthly", 0.8],
  ["/for/estheticians", "monthly", 0.8],
  ["/for/massage-therapists", "monthly", 0.8],
  ["/for/pet-groomers", "monthly", 0.8],
  ["/for/consultants", "monthly", 0.8],
  ["/for/wellness", "monthly", 0.8],
  ["/for/mobile-services", "monthly", 0.8],
  ["/for/hair-stylists", "monthly", 0.8],
  ["/for/nail-techs", "monthly", 0.8],
  ["/for/spas", "monthly", 0.8],
  ["/for/yoga-studios", "monthly", 0.8],
  ["/for/toronto", "monthly", 0.9],
  ["/for/vancouver", "monthly", 0.9],
  ["/for/calgary", "monthly", 0.9],
  ["/for/ottawa", "monthly", 0.9],
  ["/for/edmonton", "monthly", 0.9],
  ["/for/winnipeg", "monthly", 0.9],
  ["/features/online-booking", "monthly", 0.8],
  ["/features/deposits", "monthly", 0.8],
  ["/features/no-show-protection", "monthly", 0.8],
  ["/features/sms-reminders", "monthly", 0.8],
  ["/features/client-management", "monthly", 0.8],
  ["/features/intake-forms", "monthly", 0.8],
  ["/features/multi-location", "monthly", 0.8],
  ["/features/reviews", "monthly", 0.8],
  ["/blog", "weekly", 0.8],
  ["/blog/how-to-reduce-no-shows-canadian-service-businesses", "monthly", 0.7],
  ["/blog/best-appointment-booking-software-canada-2026", "monthly", 0.7],
  ["/blog/how-to-take-appointment-deposits-canada", "monthly", 0.7],
  ["/blog/salon-cancellation-policy-canada", "monthly", 0.7],
].map(([path, changeFrequency, priority]) => ({
  url: `${SITE_URL}${path}`,
  lastModified: CONTENT_DATE,
  changeFrequency: changeFrequency as SitemapRoute["changeFrequency"],
  priority: priority as number,
}));

async function fetchPublicSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  for (const apiUrl of API_CANDIDATES) {
    try {
      const response = await fetch(`${apiUrl}/api/businesses/public-slugs`, { cache: "no-store" });
      if (!response.ok) continue;
      const slugs = await response.json();
      if (Array.isArray(slugs)) return slugs as { slug: string; updatedAt: string }[];
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
    `<lastmod>${route.lastModified}</lastmod>`,
    `<changefreq>${route.changeFrequency}</changefreq>`,
    `<priority>${route.priority}</priority>`,
    "</url>",
  ].join("");
}

export async function GET() {
  const businessRoutes = (await fetchPublicSlugs()).flatMap(({ slug, updatedAt }) => {
    const lastModified = new Date(updatedAt).toISOString();
    return [
      { url: `${SITE_URL}/book/${slug}`, lastModified, changeFrequency: "weekly" as const, priority: 0.8 },
      { url: `${SITE_URL}/bio/${slug}`, lastModified, changeFrequency: "weekly" as const, priority: 0.7 },
    ];
  });

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
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
