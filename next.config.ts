import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use Node.js runtime instead of Edge for better performance with database connections
  output: "standalone",

  // Optimize production builds
  compress: true,
  poweredByHeader: false,

  // Enable experimental features for better caching
  experimental: {
    // Use server actions for better caching
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
