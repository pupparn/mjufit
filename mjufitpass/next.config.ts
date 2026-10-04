import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Slip images up to 4 MB plus multipart overhead (Vercel caps bodies at 4.5 MB).
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
