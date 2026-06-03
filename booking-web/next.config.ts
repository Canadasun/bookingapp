import type { NextConfig } from "next";

// The browser never calls the NestJS API directly.
// All /proxy/* requests are forwarded server-side (Next.js → API) so there
// are zero CORS issues regardless of what IP the client uses to reach the web app.
const API_INTERNAL = (process.env.API_INTERNAL_URL ?? "http://localhost:3001")
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  async rewrites() {
    return [
      {
        source: "/proxy/:path*",
        destination: `${API_INTERNAL}/api/:path*`,
      },
    ];
  },
  // Baseline security headers. NOTE: intentionally no X-Frame-Options / frame
  // CSP — the booking widget (/book/:slug?embed=1) is embedded in an iframe on
  // customers' own sites, so framing must stay allowed.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
