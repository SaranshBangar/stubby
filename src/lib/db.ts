import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Access the D1 binding (`DB` in wrangler.toml) from anywhere in the app.
 *
 * In route handlers / server components we resolve it via OpenNext's
 * Cloudflare context. The cron path (src/worker.ts) gets `env` directly and
 * passes the binding in, so we also accept an explicit D1Database.
 */
export function getDB(explicit?: D1Database): D1Database {
  if (explicit) return explicit;
  const { env } = getCloudflareContext();
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) {
    throw new Error(
      "D1 binding `DB` not found. Check wrangler.toml and run migrations.",
    );
  }
  return db;
}

/** Resolve env vars (secrets + vars) regardless of runtime path. */
export function getEnv(): Record<string, unknown> {
  try {
    const { env } = getCloudflareContext();
    return env as unknown as Record<string, unknown>;
  } catch {
    // `next dev` outside the Worker context.
    return (typeof process !== "undefined" ? process.env : {}) as Record<
      string,
      unknown
    >;
  }
}
