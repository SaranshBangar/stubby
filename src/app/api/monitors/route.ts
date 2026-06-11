import { getDB, getEnv } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, created, badRequest, unauthorized, forbidden } from "@/lib/http";
import { getLimitsForToken, computeExpiresAt, clampInterval } from "@/lib/tier";
import { INTERVAL_CHOICES } from "@/config/limits";
import type { MonitorRow } from "@/lib/types";

// GET /api/monitors — list this token's monitors.
export async function GET(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const db = getDB();
  const { results } = await db
    .prepare("SELECT * FROM monitors WHERE owner_token = ?1 ORDER BY created_at DESC")
    .bind(token)
    .all<MonitorRow>();
  return ok({ monitors: results ?? [] });
}

// POST /api/monitors — create a monitor. Enforces count + interval-floor.
export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  // ── Validate target URL (http/https only). ──
  const targetUrl = String(body.target_url ?? "").trim();
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return badRequest("target_url must be a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return badRequest("target_url must be http(s)");
  }

  const interval = Number(body.interval_minutes);
  if (!INTERVAL_CHOICES.includes(interval as (typeof INTERVAL_CHOICES)[number])) {
    return badRequest(`interval_minutes must be one of ${INTERVAL_CHOICES.join(", ")}`);
  }

  const alertEmail = String(body.alert_email ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(alertEmail)) {
    return badRequest("alert_email must be a valid email");
  }

  const db = getDB();
  const env = getEnv();
  const { limits } = await getLimitsForToken(db, token, env);

  // Enforce count limit.
  const countRow = await db
    .prepare("SELECT COUNT(*) AS n FROM monitors WHERE owner_token = ?1")
    .bind(token)
    .first<{ n: number }>();
  if ((countRow?.n ?? 0) >= limits.maxMonitors) {
    return forbidden(
      `Monitor limit reached (${limits.maxMonitors}). Upgrade to Pro for more.`,
    );
  }

  // Clamp the interval up to the tier floor (free can't go below 15 min).
  const effectiveInterval = clampInterval(limits, interval);

  const now = Date.now();
  const expiresAt = computeExpiresAt(limits, now);
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO monitors
        (id, owner_token, target_url, interval_minutes, last_checked_at, last_status, is_up, alert_email, created_at, expires_at)
       VALUES (?1, ?2, ?3, ?4, NULL, NULL, 1, ?5, ?6, ?7)`,
    )
    .bind(id, token, targetUrl, effectiveInterval, alertEmail, now, expiresAt)
    .run();

  const row = await db
    .prepare("SELECT * FROM monitors WHERE id = ?1")
    .bind(id)
    .first<MonitorRow>();
  return created({ monitor: row });
}
