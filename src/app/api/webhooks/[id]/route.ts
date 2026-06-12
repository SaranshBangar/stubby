import { getDB } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, unauthorized, notFound } from "@/lib/http";
import type { WebhookEndpointRow } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  const row = await getDB()
    .prepare("SELECT * FROM webhook_endpoints WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .first<WebhookEndpointRow>();
  return row ? ok({ endpoint: row }) : notFound();
}

// DELETE - removes the endpoint; its captured requests cascade via FK.
export async function DELETE(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  const res = await getDB()
    .prepare("DELETE FROM webhook_endpoints WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .run();
  if (!res.meta.changes) return notFound();
  return ok({ deleted: id });
}
