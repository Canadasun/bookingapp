import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// The browser never calls the NestJS API directly.
// All /proxy/* requests are forwarded server-side (Next.js → API) so there
// are zero CORS issues regardless of what IP the client uses to reach the web app.
const API_INTERNAL = (
  process.env.API_INTERNAL_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? "http://localhost:3001"
).replace(/\/+$/, "").replace(/\/api$/, "");

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
      // /contact is a well-known alias; forward permanently to the support page.
      {
        source: "/contact",
        destination: "/support",
        permanent: true,
      },
      // Legacy favicon path — browsers request /favicon.ico directly.
      {
        source: "/favicon.ico",
        destination: "/icon",
        permanent: false,
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
    // CSP for auth pages (login, register, etc.) — no Stripe frames needed here.
    // Prevents credential phishing via XSS on sign-in flows.
    const authCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.clarity.ms",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://api.pulseappointments.com https://www.clarity.ms https://c.clarity.ms",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ");

    // Build connect-src dynamically so it tracks the API URL env var instead of
    // a hardcoded Railway hostname that will break if the domain changes.
    const wsOrigin = (process.env.NEXT_PUBLIC_WS_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "")
      .replace(/\/+$/, "").replace(/\/api$/, "");
    const wsOriginWss = wsOrigin ? wsOrigin.replace(/^https/, "wss").replace(/^http/, "ws") : "";
    const apiConnectSrc = [
      wsOrigin && wsOrigin !== wsOriginWss ? wsOrigin : "",
      wsOriginWss || "",
    ].filter(Boolean).join(" ");

    // CSP for authenticated areas. script-src includes 'unsafe-inline' because
    // Next.js injects inline hydration scripts; without nonces that's unavoidable.
    // object-src 'none' and base-uri 'self' are the most impactful restrictions.
    const dashboardCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.clarity.ms",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      `connect-src 'self' https://api.pulseappointments.com wss://api.pulseappointments.com ${apiConnectSrc} https://api.stripe.com https://js.stripe.com https://www.clarity.ms https://c.clarity.ms`.trim(),
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
      // Auth pages get CSP to block XSS-based credential phishing.
      ...[
        "/login", "/register", "/forgot-password", "/reset-password",
        "/change-password", "/verify-email", "/support",
      ].map((source) => ({
        source,
        headers: [
          { key: "Content-Security-Policy", value: authCsp },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      })),
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "pulse-appointments",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
