/**
 * ★ SINGLE SOURCE OF TRUTH for tier limits.
 *
 * Tune these numbers here (or override via env vars). Every limit check in
 * the app imports from this file — change a number once, it applies
 * everywhere (API create routes, cron interval floor, history pruning).
 */

// Read an integer env var with a fallback. Works in the Workers runtime
// where env is passed per-request; we also fall back to process.env for
// `next dev`. Callers may pass an explicit env object for the Worker path.
function intFromEnv(
  env: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  const raw =
    (env?.[key] as string | undefined) ??
    (typeof process !== "undefined" ? process.env?.[key] : undefined);
  const n = raw != null ? parseInt(String(raw), 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export type Tier = "free" | "pro";

export interface Limits {
  maxMocks: number;
  maxMonitors: number;
  /** Minimum allowed monitor interval (minutes). Free is floored higher. */
  minIntervalMinutes: number;
  /** Resource lifetime in days; null = never expires (persistent). */
  expiryDays: number | null;
  /** How many recent checks to retain/return per monitor. */
  historyLimit: number;
  /** Webhook Inspector: how many capture endpoints a token may own. */
  maxWebhookEndpoints: number;
  /** Webhook Inspector: stored requests retained per endpoint. */
  webhookRequestsPerEndpoint: number;
}

// Allowed interval choices surfaced in the UI. Free clamps to >= its floor.
export const INTERVAL_CHOICES = [1, 5, 15, 30, 60] as const;

export function getLimits(
  tier: Tier,
  env?: Record<string, unknown>,
): Limits {
  if (tier === "pro") {
    return {
      maxMocks: intFromEnv(env, "PRO_MAX_MOCKS", 25),
      maxMonitors: intFromEnv(env, "PRO_MAX_MONITORS", 25),
      minIntervalMinutes: intFromEnv(env, "PRO_MIN_INTERVAL_MINUTES", 1),
      expiryDays: null, // persistent
      historyLimit: intFromEnv(env, "CHECKS_HISTORY_LIMIT", 50),
      maxWebhookEndpoints: intFromEnv(env, "PRO_MAX_WEBHOOK_ENDPOINTS", 25),
      webhookRequestsPerEndpoint: intFromEnv(
        env,
        "PRO_WEBHOOK_REQUESTS_PER_ENDPOINT",
        500,
      ),
    };
  }
  return {
    maxMocks: intFromEnv(env, "FREE_MAX_MOCKS", 3),
    maxMonitors: intFromEnv(env, "FREE_MAX_MONITORS", 1),
    minIntervalMinutes: intFromEnv(env, "FREE_MIN_INTERVAL_MINUTES", 15),
    expiryDays: intFromEnv(env, "FREE_EXPIRY_DAYS", 7),
    historyLimit: intFromEnv(env, "FREE_CHECKS_HISTORY_LIMIT", 20),
    maxWebhookEndpoints: intFromEnv(env, "FREE_MAX_WEBHOOK_ENDPOINTS", 3),
    webhookRequestsPerEndpoint: intFromEnv(
      env,
      "FREE_WEBHOOK_REQUESTS_PER_ENDPOINT",
      50,
    ),
  };
}

// Hard cap on stored webhook request bodies (bytes). Bigger bodies are
// truncated at capture time; body_size records the true size.
export const WEBHOOK_BODY_MAX_BYTES = 100 * 1024;

// Cron tuning.
export function getCronConcurrency(env?: Record<string, unknown>): number {
  return intFromEnv(env, "CRON_CONCURRENCY", 10);
}

// Per-ping timeout in the monitor cron (ms).
export function getPingTimeoutMs(env?: Record<string, unknown>): number {
  return intFromEnv(env, "PING_TIMEOUT_MS", 10_000);
}
