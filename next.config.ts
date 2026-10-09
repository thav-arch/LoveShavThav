import type { NextConfig } from "next";

const usingPglite = !process.env.DATABASE_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // native / WASM packages are loaded from node_modules at runtime, not bundled
  serverExternalPackages: ["@electric-sql/pglite", "sharp", "pg"],
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 75, 85],
    localPatterns: [{ pathname: "/uploads/**" }, { pathname: "/projects/**" }],
  },
  experimental: {
    // local PGlite: build pages in one worker (each loads the snapshot into memory)
    ...(usingPglite ? { cpus: 1 } : {}),
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        // project media in /public: cache a day, refresh quietly for a week
        // (filenames can be reused when you replace a placeholder, so not "immutable")
        source: "/projects/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
