import { getDB } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, unauthorized, notFound } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; requestId: string }> };

// DELETE /api/webhooks/:id/requests/:requestId — remove one captured request.
export async function DELETE(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id, requestId } = await params;
  const db = getDB();

  const owns = await db
    .prepare("SELECT id FROM webhook_endpoints WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .first<{ id: string }>();
  if (!owns) return notFound();

  const res = await db
    .prepare("DELETE FROM webhook_requests WHERE id = ?1 AND endpoint_id = ?2")
    .bind(requestId, id)
    .run();
  if (!res.meta.changes) return notFound();
  return ok({ deleted: requestId });
}
