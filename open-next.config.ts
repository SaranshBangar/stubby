import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal OpenNext config for Cloudflare Workers.
// Defaults are fine for Stubby — no ISR/cache adapters needed.
export default defineCloudflareConfig({});
