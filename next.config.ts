import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [
      {
        source: "/api/db/:path*",
        destination: `http://127.0.0.1:${process.env.API_PORT || 4000}/api/db/:path*`,
      },
    ];
  },
};

export default nextConfig;
