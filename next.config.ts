import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  images: {
    unoptimized: true, // No sharp dependency needed on Raspberry Pi
  },
};

export default nextConfig;
