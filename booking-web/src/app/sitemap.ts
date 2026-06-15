import type { MetadataRoute } from "next";

const SITE_URL = "https://www.pulseappointments.com";

// Update this date whenever meaningful content changes are deployed.
const CONTENT_DATE = new Date("2026-06-15");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
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
}
