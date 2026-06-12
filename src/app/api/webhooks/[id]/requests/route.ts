import { getDB } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, unauthorized, notFound } from "@/lib/http";
import type { WebhookRequestRow } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

async function ownedEndpoint(db: D1Database, id: string, token: string) {
  return db
    .prepare("SELECT id FROM webhook_endpoints WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .first<{ id: string }>();
}

// GET /api/webhooks/:id/requests - captured requests, newest first.
// Paginated via ?limit & ?offset (the UI polls page 1 every 3s).
export async function GET(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  const db = getDB();
  if (!(await ownedEndpoint(db, id, token))) return notFound();

  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1),
    100,
  );
  const offset = Math.max(
    parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
    0,
  );

  const { results } = await db
    .prepare(
      `SELECT * FROM webhook_requests
        WHERE endpoint_id = ?1
        ORDER BY received_at DESC
        LIMIT ?2 OFFSET ?3`,
    )
    .bind(id, limit, offset)
    .all<WebhookRequestRow>();

  const totalRow = await db
    .prepare("SELECT COUNT(*) AS n FROM webhook_requests WHERE endpoint_id = ?1")
    .bind(id)
    .first<{ n: number }>();

  return ok({ requests: results ?? [], total: totalRow?.n ?? 0 });
}

// DELETE /api/webhooks/:id/requests - clear all captured requests.
export async function DELETE(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  const db = getDB();
  if (!(await ownedEndpoint(db, id, token))) return notFound();

  await db
    .prepare("DELETE FROM webhook_requests WHERE endpoint_id = ?1")
    .bind(id)
    .run();
  return ok({ cleared: id });
}
