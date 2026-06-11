import { getDB, getEnv } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, badRequest, unauthorized, notFound } from "@/lib/http";
import { getLimitsForToken, clampInterval } from "@/lib/tier";
import { INTERVAL_CHOICES } from "@/config/limits";
import type { MonitorRow } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

async function owned(db: D1Database, id: string, token: string) {
  return db
    .prepare("SELECT * FROM monitors WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .first<MonitorRow>();
}

export async function GET(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  const row = await owned(getDB(), id, token);
  return row ? ok({ monitor: row }) : notFound();
}

// PUT — edit interval / alert_email / target_url.
export async function PUT(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  const db = getDB();
  const existing = await owned(db, id, token);
  if (!existing) return notFound();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  let targetUrl = existing.target_url;
  if (body.target_url != null) {
    targetUrl = String(body.target_url).trim();
    try {
      const p = new URL(targetUrl);
      if (p.protocol !== "http:" && p.protocol !== "https:") {
        return badRequest("target_url must be http(s)");
      }
    } catch {
      return badRequest("target_url must be a valid URL");
    }
  }

  let interval = existing.interval_minutes;
  if (body.interval_minutes != null) {
    interval = Number(body.interval_minutes);
    if (!INTERVAL_CHOICES.includes(interval as (typeof INTERVAL_CHOICES)[number])) {
      return badRequest(`interval_minutes must be one of ${INTERVAL_CHOICES.join(", ")}`);
    }
    const { limits } = await getLimitsForToken(db, token, getEnv());
    interval = clampInterval(limits, interval);
  }

  let alertEmail = existing.alert_email;
  if (body.alert_email != null) {
    alertEmail = String(body.alert_email).trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(alertEmail)) {
      return badRequest("alert_email must be a valid email");
    }
  }

  // Keyword assertion — only touched when the request mentions it.
  let keywordEnabled = existing.keyword_check_enabled === 1;
  let keywordString = existing.keyword_check_string;
  let keywordMode = existing.keyword_check_mode as string | null;
  if (body.keyword_check_enabled != null) {
    keywordEnabled = body.keyword_check_enabled === true;
  }
  if (body.keyword_check_string != null) {
    keywordString = String(body.keyword_check_string).slice(0, 200) || null;
  }
  if (body.keyword_check_mode != null) {
    keywordMode = String(body.keyword_check_mode);
  }
  if (keywordEnabled) {
    if (!keywordString) {
      return badRequest("keyword_check_string is required when the keyword check is enabled");
    }
    if (keywordMode !== "must_contain" && keywordMode !== "must_not_contain") {
      return badRequest("keyword_check_mode must be must_contain or must_not_contain");
    }
  }

  await db
    .prepare(
      `UPDATE monitors
          SET target_url=?1, interval_minutes=?2, alert_email=?3,
              keyword_check_enabled=?4, keyword_check_string=?5, keyword_check_mode=?6
        WHERE id=?7 AND owner_token=?8`,
    )
    .bind(
      targetUrl,
      interval,
      alertEmail,
      keywordEnabled ? 1 : 0,
      keywordString,
      keywordMode,
      id,
      token,
    )
    .run();

  const row = await owned(db, id, token);
  return ok({ monitor: row });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  const db = getDB();
  // checks rows cascade-delete via FK (ON DELETE CASCADE).
  const res = await db
    .prepare("DELETE FROM monitors WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .run();
  if (!res.meta.changes) return notFound();
  return ok({ deleted: id });
}
