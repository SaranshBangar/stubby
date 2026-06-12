import { getDB } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, unauthorized, notFound } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; ruleId: string }> };

// DELETE /api/mocks/:id/rules/:ruleId - remove one rule.
export async function DELETE(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id, ruleId } = await params;
  const db = getDB();

  const owns = await db
    .prepare("SELECT id FROM mocks WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .first<{ id: string }>();
  if (!owns) return notFound();

  const res = await db
    .prepare("DELETE FROM mock_rules WHERE id = ?1 AND mock_id = ?2")
    .bind(ruleId, id)
    .run();
  if (!res.meta.changes) return notFound();
  return ok({ deleted: ruleId });
}
