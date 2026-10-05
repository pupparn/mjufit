import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E runs its own `next dev` beside yours; a separate dir avoids Next's single-instance lock.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      // Slip images up to 4 MB plus multipart overhead (Vercel caps bodies at 4.5 MB).
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
