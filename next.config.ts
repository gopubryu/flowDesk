import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "ws",
  ],
  async redirects() {
    return [
      { source: "/purchase-plans", destination: "/sales-plans", permanent: true },
      { source: "/purchase-plans/new", destination: "/sales-plans/new", permanent: true },
      { source: "/purchase-plans/status", destination: "/sales-plans/status", permanent: true },
    ];
  },
};

export default nextConfig;
