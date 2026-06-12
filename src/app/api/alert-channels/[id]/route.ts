import { getDB } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, unauthorized, notFound } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

// DELETE - remove a channel; join rows + delivery log cascade via FK.
export async function DELETE(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  const res = await getDB()
    .prepare("DELETE FROM alert_channels WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .run();
  if (!res.meta.changes) return notFound();
  return ok({ deleted: id });
}
