import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep handlers edge-friendly. No Node-only modules in API routes.
  reactStrictMode: true,
};

export default nextConfig;

// OpenNext Cloudflare: initialize dev bindings so `next dev` can read D1, etc.
// Guarded to development only — it spawns `workerd`, which must NOT run during
// a production `next build` (e.g. on a CI image with an older glibc).
if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then(({ initOpenNextCloudflareForDev }) =>
    initOpenNextCloudflareForDev(),
  );
}
