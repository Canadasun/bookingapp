import type { MetadataRoute } from "next";

const SITE_URL = "https://www.pulseappointments.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ["", "/login", "/register", "/book", "/terms", "/privacy"].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.6,
  }));
}
