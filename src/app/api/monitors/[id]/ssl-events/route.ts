import { getDB } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, unauthorized, notFound } from "@/lib/http";
import { SSL_EVENTS_HISTORY_LIMIT } from "@/config/limits";
import type { SslEventRow } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/monitors/:id/ssl-events - recent TLS inspections, newest first.
export async function GET(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  const db = getDB();

  const owns = await db
    .prepare("SELECT id FROM monitors WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .first<{ id: string }>();
  if (!owns) return notFound();

  const { results } = await db
    .prepare(
      "SELECT * FROM ssl_events WHERE monitor_id = ?1 ORDER BY checked_at DESC LIMIT ?2",
    )
    .bind(id, SSL_EVENTS_HISTORY_LIMIT)
    .all<SslEventRow>();

  return ok({ events: results ?? [] });
}
