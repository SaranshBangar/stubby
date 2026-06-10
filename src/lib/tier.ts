import { getLimits, type Limits, type Tier } from "@/config/limits";

/**
 * Tier resolution + limit enforcement, keyed on owner_token.
 *
 * A token is "pro" iff it has an active row in the `accounts` table (created
 * by the Stripe webhook). Otherwise "free". All limit numbers come from
 * src/config/limits.ts so they're tunable in one place.
 */

export async function getTier(
  db: D1Database,
  ownerToken: string,
): Promise<Tier> {
  const row = await db
    .prepare("SELECT status FROM accounts WHERE owner_token = ?1 LIMIT 1")
    .bind(ownerToken)
    .first<{ status: string }>();
  return row?.status === "active" ? "pro" : "free";
}

export async function getLimitsForToken(
  db: D1Database,
  ownerToken: string,
  env?: Record<string, unknown>,
): Promise<{ tier: Tier; limits: Limits }> {
  const tier = await getTier(db, ownerToken);
  return { tier, limits: getLimits(tier, env) };
}

// Compute an expires_at (epoch ms) from the tier's expiryDays, or null if
// the tier keeps resources persistent.
export function computeExpiresAt(limits: Limits, now: number): number | null {
  if (limits.expiryDays == null) return null;
  return now + limits.expiryDays * 24 * 60 * 60 * 1000;
}

// Clamp a requested monitor interval up to the tier's allowed floor.
export function clampInterval(limits: Limits, requested: number): number {
  return Math.max(requested, limits.minIntervalMinutes);
}
