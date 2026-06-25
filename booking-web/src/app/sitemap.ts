import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

const SITE_URL = "https://www.pulseappointments.com";
const RAW_API_URL = (
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.RAILWAY_SERVICE_BOOKINGAPP_URL ??
  "http://localhost:3001"
).replace(/\/+$/, "").replace(/\/api$/, "");
const API_URL = /^https?:\/\//i.test(RAW_API_URL) ? RAW_API_URL : `https://${RAW_API_URL}`;

const CONTENT_DATE = new Date();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,                                        lastModified: CONTENT_DATE, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/pricing`,                                 lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/demo`,                                    lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/reviews`,                                 lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/referrals`,                               lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/register`,                                lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/login`,                                   lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/book`,                                    lastModified: CONTENT_DATE, changeFrequency: "daily",   priority: 0.7 },
    { url: `${SITE_URL}/support`,                                 lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/about`,                                   lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/trust`,                                   lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/terms`,                                   lastModified: CONTENT_DATE, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/privacy`,                                 lastModified: CONTENT_DATE, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/accessibility`,                           lastModified: CONTENT_DATE, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/status`,                                  lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/security`,                                lastModified: CONTENT_DATE, changeFrequency: "yearly",  priority: 0.5 },
    { url: `${SITE_URL}/canadian-privacy`,                        lastModified: CONTENT_DATE, changeFrequency: "yearly",  priority: 0.5 },
    { url: `${SITE_URL}/changelog`,                               lastModified: CONTENT_DATE, changeFrequency: "weekly",  priority: 0.5 },
    { url: `${SITE_URL}/compare`,                                 lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/compare/pulse-vs-square-appointments`,    lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/compare/pulse-vs-calendly`,               lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/compare/pulse-vs-acuity-scheduling`,      lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/compare/pulse-vs-jane-app`,               lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/compare/pulse-vs-vagaro`,                 lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/compare/pulse-vs-glossgenius`,            lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/features`,                                lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/for`,                                     lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/for/salons`,                              lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/for/barbers`,                             lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/for/lash-techs`,                          lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/for/estheticians`,                        lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/for/massage-therapists`,                  lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/for/pet-groomers`,                        lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/for/consultants`,                         lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/for/wellness`,                            lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/for/mobile-services`,                     lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/for/hair-stylists`,                       lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/for/nail-techs`,                          lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/for/spas`,                                lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/for/yoga-studios`,                        lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/for/toronto`,                             lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/for/vancouver`,                           lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/for/calgary`,                             lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/for/ottawa`,                              lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/for/edmonton`,                            lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/for/winnipeg`,                            lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/features/online-booking`,                  lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/features/deposits`,                        lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/features/no-show-protection`,              lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/features/sms-reminders`,                   lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/features/client-management`,                lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/features/intake-forms`,                     lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/features/multi-location`,                   lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/features/reviews`,                          lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/blog`,                                     lastModified: CONTENT_DATE, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${SITE_URL}/blog/how-to-reduce-no-shows-canadian-service-businesses`, lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/blog/best-appointment-booking-software-canada-2026`,      lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/blog/how-to-take-appointment-deposits-canada`,            lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/blog/salon-cancellation-policy-canada`,                   lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.7 },
  ];

  // Dynamically include all public (non-suspended) business booking pages.
  const publicBusinessRoutes: MetadataRoute.Sitemap = await fetch(
    `${API_URL}/api/businesses/public-slugs`,
    { cache: "no-store" },
  )
    .then((r) => r.json() as Promise<{ slug: string; updatedAt: string }[]>)
    .then((slugs) => slugs.flatMap(({ slug, updatedAt }) => {
      const lastModified = new Date(updatedAt);
      return [
        {
          url: `${SITE_URL}/book/${slug}`,
          lastModified,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        },
        {
          url: `${SITE_URL}/bio/${slug}`,
          lastModified,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        },
      ];
    }))
    .catch(() => []); // if API is unreachable, degrade gracefully

  return [...staticRoutes, ...publicBusinessRoutes];
}
