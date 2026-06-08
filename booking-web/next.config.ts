import type { NextConfig } from "next";

// The browser never calls the NestJS API directly.
// All /proxy/* requests are forwarded server-side (Next.js → API) so there
// are zero CORS issues regardless of what IP the client uses to reach the web app.
const API_INTERNAL = (process.env.API_INTERNAL_URL ?? "http://localhost:3001")
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  // Canonical host is www.pulseappointments.com. Any request that reaches the
  // app on the bare apex is 308-redirected (method-preserving, cacheable) to
  // the www host so links, SEO, and cookies all live on a single origin.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "pulseappointments.com" }],
        destination: "https://www.pulseappointments.com/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/proxy/:path*",
        destination: `${API_INTERNAL}/api/:path*`,
      },
    ];
  },
  // Baseline security headers. NOTE: intentionally no X-Frame-Options / frame
  // CSP on public paths — the booking widget (/book/:slug?embed=1) is embedded
  // in an iframe on customers' own sites, so framing must stay allowed there.
  // Dashboard and admin routes are never embedded, so they get a full CSP.
  async headers() {
    // CSP for authenticated areas. script-src includes 'unsafe-inline' because
    // Next.js injects inline hydration scripts; without nonces that's unavoidable.
    // object-src 'none' and base-uri 'self' are the most impactful restrictions.
    const dashboardCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' wss://api.pulseappointments.com https://api.stripe.com https://js.stripe.com",
      "font-src 'self' data:",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ");

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
      {
        source: "/dashboard/:path*",
        headers: [
          { key: "Content-Security-Policy", value: dashboardCsp },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Content-Security-Policy", value: dashboardCsp },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/my/:path*",
        headers: [
          { key: "Content-Security-Policy", value: dashboardCsp },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
