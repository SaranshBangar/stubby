import { getDB, getEnv } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, created, badRequest, unauthorized, forbidden } from "@/lib/http";
import { getLimitsForToken } from "@/lib/tier";
import type { AlertChannelRow } from "@/lib/types";

const CHANNEL_TYPES = ["slack", "discord", "webhook"] as const;

// GET /api/alert-channels - list this token's channels (newest first).
export async function GET(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const db = getDB();
  const { results } = await db
    .prepare(
      "SELECT * FROM alert_channels WHERE owner_token = ?1 ORDER BY created_at DESC",
    )
    .bind(token)
    .all<AlertChannelRow>();
  return ok({ channels: results ?? [] });
}

// POST /api/alert-channels - save a channel. Enforces the tier's cap.
export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const type = String(body.type ?? "");
  if (!CHANNEL_TYPES.includes(type as (typeof CHANNEL_TYPES)[number])) {
    return badRequest(`type must be one of ${CHANNEL_TYPES.join(", ")}`);
  }

  const label = String(body.label ?? "").trim().slice(0, 80);
  if (!label) return badRequest("label is required");

  const url = String(body.url ?? "").trim();
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return badRequest("url must be http(s)");
    }
  } catch {
    return badRequest("url must be a valid URL");
  }

  const db = getDB();
  const { limits } = await getLimitsForToken(db, token, getEnv());
  const countRow = await db
    .prepare("SELECT COUNT(*) AS n FROM alert_channels WHERE owner_token = ?1")
    .bind(token)
    .first<{ n: number }>();
  if ((countRow?.n ?? 0) >= limits.maxAlertChannels) {
    return forbidden(
      `Alert channel limit reached (${limits.maxAlertChannels}). Upgrade to Pro for more.`,
    );
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO alert_channels (id, owner_token, type, label, url, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(id, token, type, label, url, Date.now())
    .run();

  const row = await db
    .prepare("SELECT * FROM alert_channels WHERE id = ?1")
    .bind(id)
    .first<AlertChannelRow>();
  return created({ channel: row });
}
