import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep handlers edge-friendly. No Node-only modules in API routes.
  reactStrictMode: true,
};

export default nextConfig;

// OpenNext Cloudflare: initialize dev bindings so `next dev` can read D1, etc.
// This is a no-op in production. Safe to keep.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
