import type { NextConfig } from "next";

const backendPort = process.env.BACKEND_PORT || 3001;
const backendOrigin = `http://localhost:${backendPort}`; // CHANGE THIS ONCE DEPLOYED

const nextConfig: NextConfig = {
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
