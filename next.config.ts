import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: process.env.BASE_PATH || "",
  // NEXTAUTH_URL muss explizit an den Client exponiert werden,
  // damit signIn()/signOut() Requests an /fk/api/auth senden.
  // Turbopack inlined process.env.NEXTAUTH_URL sonst nicht ins Client-Bundle.
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "",
  },
  images: {
    unoptimized: true, // No sharp dependency needed on Raspberry Pi
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
