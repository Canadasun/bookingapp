import type { NextConfig } from "next";

// The browser never calls the NestJS API directly.
// All /proxy/* requests are forwarded server-side (Next.js → API) so there
// are zero CORS issues regardless of what IP the client uses to reach the web app.
const API_INTERNAL = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

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
};

export default nextConfig;
