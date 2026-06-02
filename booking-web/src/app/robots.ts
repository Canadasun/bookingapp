import type { MetadataRoute } from "next";

const SITE_URL = "https://www.pulseappointments.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private/app areas out of search results.
      disallow: ["/dashboard", "/my", "/change-password", "/proxy"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
