import { getDB, getEnv } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, created, badRequest, unauthorized, forbidden } from "@/lib/http";
import { getLimitsForToken, computeExpiresAt, clampInterval } from "@/lib/tier";
import { INTERVAL_CHOICES } from "@/config/limits";
import type { MonitorRow } from "@/lib/types";

// GET /api/monitors - list this token's monitors.
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

// POST /api/monitors - create a monitor. Enforces count + interval-floor.
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

  // Optional keyword assertion on the response body.
  const keywordEnabled = body.keyword_check_enabled === true;
  let keywordString: string | null = null;
  let keywordMode: string | null = null;
  if (keywordEnabled) {
    keywordString = String(body.keyword_check_string ?? "").slice(0, 200);
    if (!keywordString) {
      return badRequest("keyword_check_string is required when the keyword check is enabled");
    }
    keywordMode = String(body.keyword_check_mode ?? "must_contain");
    if (keywordMode !== "must_contain" && keywordMode !== "must_not_contain") {
      return badRequest("keyword_check_mode must be must_contain or must_not_contain");
    }
  }

  // Optional alert channel links.
  const channelIds: string[] = Array.isArray(body.channel_ids)
    ? body.channel_ids.map((c) => String(c))
    : [];

  const db = getDB();
  const env = getEnv();
  const { limits } = await getLimitsForToken(db, token, env);

  // Channels must belong to this token.
  if (channelIds.length > 0) {
    const placeholders = channelIds.map((_, i) => `?${i + 2}`).join(",");
    const owned = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM alert_channels WHERE owner_token = ?1 AND id IN (${placeholders})`,
      )
      .bind(token, ...channelIds)
      .first<{ n: number }>();
    if ((owned?.n ?? 0) !== channelIds.length) {
      return badRequest("One or more alert channels do not exist");
    }
  }

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
        (id, owner_token, target_url, interval_minutes, last_checked_at, last_status, is_up, alert_email, created_at, expires_at,
         keyword_check_enabled, keyword_check_string, keyword_check_mode)
       VALUES (?1, ?2, ?3, ?4, NULL, NULL, 1, ?5, ?6, ?7, ?8, ?9, ?10)`,
    )
    .bind(
      id,
      token,
      targetUrl,
      effectiveInterval,
      alertEmail,
      now,
      expiresAt,
      keywordEnabled ? 1 : 0,
      keywordString,
      keywordMode,
    )
    .run();

  for (const channelId of channelIds) {
    await db
      .prepare(
        "INSERT INTO monitor_alert_channels (monitor_id, channel_id) VALUES (?1, ?2)",
      )
      .bind(id, channelId)
      .run();
  }

  const row = await db
    .prepare("SELECT * FROM monitors WHERE id = ?1")
    .bind(id)
    .first<MonitorRow>();
  return created({ monitor: row });
}
