import { getDB, getEnv } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, unauthorized, notFound } from "@/lib/http";
import { getLimitsForToken } from "@/lib/tier";
import type { CheckRow } from "@/lib/types";

export const runtime = "edge";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/monitors/:id/checks — recent check history, newest first.
// Count capped by the tier's historyLimit (free sees less than Pro).
export async function GET(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  const db = getDB();

  // Ownership check (token must own the monitor).
  const owns = await db
    .prepare("SELECT id FROM monitors WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .first<{ id: string }>();
  if (!owns) return notFound();

  const { limits } = await getLimitsForToken(db, token, getEnv());
  const { results } = await db
    .prepare(
      "SELECT * FROM checks WHERE monitor_id = ?1 ORDER BY checked_at DESC LIMIT ?2",
    )
    .bind(id, limits.historyLimit)
    .all<CheckRow>();

  return ok({ checks: results ?? [] });
}
