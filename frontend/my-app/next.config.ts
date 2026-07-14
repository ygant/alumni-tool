import type { NextConfig } from "next";

const backendOrigin = "http://localhost:3001"; // CHANGE THIS ONCE DEPLOYED

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
