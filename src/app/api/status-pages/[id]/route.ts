import { getDB, getEnv } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, badRequest, unauthorized, notFound, forbidden } from "@/lib/http";
import { getLimitsForToken } from "@/lib/tier";
import {
  parseStatusPageBody,
  ownsAllMonitors,
  replacePageMonitors,
} from "@/lib/statusPages";
import type { StatusPageRow } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

async function owned(db: D1Database, id: string, token: string) {
  return db
    .prepare("SELECT * FROM status_pages WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .first<StatusPageRow>();
}

// PUT - full update: title, description, slug, badge, monitor selection.
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
  const parsed = parseStatusPageBody(body);
  if ("error" in parsed) return badRequest(parsed.error);

  const { limits } = await getLimitsForToken(db, token, getEnv());
  if (parsed.monitors.length > limits.maxMonitorsPerStatusPage) {
    return forbidden(
      `A status page can show at most ${limits.maxMonitorsPerStatusPage} monitors on your plan.`,
    );
  }
  if (!(await ownsAllMonitors(db, token, parsed.monitors.map((m) => m.monitor_id)))) {
    return badRequest("One or more monitors do not exist");
  }

  const showPoweredBy = limits.canHidePoweredBy ? parsed.showPoweredBy : true;

  try {
    await db
      .prepare(
        `UPDATE status_pages
            SET slug=?1, title=?2, description=?3, show_powered_by=?4
          WHERE id=?5 AND owner_token=?6`,
      )
      .bind(parsed.slug, parsed.title, parsed.description, showPoweredBy ? 1 : 0, id, token)
      .run();
  } catch (err) {
    if (String(err).includes("UNIQUE")) return badRequest("Slug already taken");
    throw err;
  }

  await replacePageMonitors(db, id, parsed.monitors);

  const row = await owned(db, id, token);
  return ok({ page: row });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  // status_page_monitors rows cascade via FK.
  const res = await getDB()
    .prepare("DELETE FROM status_pages WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .run();
  if (!res.meta.changes) return notFound();
  return ok({ deleted: id });
}
