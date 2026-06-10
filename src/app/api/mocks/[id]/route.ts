import { getDB } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, badRequest, unauthorized, notFound } from "@/lib/http";
import type { MockRow } from "@/lib/types";

export const runtime = "edge";

type Ctx = { params: Promise<{ id: string }> };

// All ops verify owner_token matches — a token can only touch its own rows.
async function owned(
  db: D1Database,
  id: string,
  token: string,
): Promise<MockRow | null> {
  return db
    .prepare("SELECT * FROM mocks WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .first<MockRow>();
}

export async function GET(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  const row = await owned(getDB(), id, token);
  return row ? ok({ mock: row }) : notFound();
}

// PUT — partial update of editable fields.
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

  const statusCode =
    body.status_code != null ? Number(body.status_code) : existing.status_code;
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    return badRequest("status_code must be 100–599");
  }
  const delayMs = body.delay_ms != null ? Number(body.delay_ms) : existing.delay_ms;
  if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 30_000) {
    return badRequest("delay_ms must be 0–30000");
  }

  let headersJson = existing.headers_json;
  if (body.headers != null) {
    const h = body.headers;
    if (typeof h !== "object" || h === null || Array.isArray(h)) {
      return badRequest("headers must be an object");
    }
    headersJson = JSON.stringify(h);
  }

  let bodyJson = existing.body_json;
  if (body.body != null) {
    bodyJson = typeof body.body === "string" ? body.body : JSON.stringify(body.body);
  }

  await db
    .prepare(
      `UPDATE mocks SET status_code=?1, headers_json=?2, body_json=?3, delay_ms=?4
       WHERE id=?5 AND owner_token=?6`,
    )
    .bind(statusCode, headersJson, bodyJson, delayMs, id, token)
    .run();

  const row = await owned(db, id, token);
  return ok({ mock: row });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  const db = getDB();
  const res = await db
    .prepare("DELETE FROM mocks WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .run();
  if (!res.meta.changes) return notFound();
  return ok({ deleted: id });
}
