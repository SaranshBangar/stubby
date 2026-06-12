import { getDB, getEnv } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, created, badRequest, unauthorized, forbidden } from "@/lib/http";
import { getLimitsForToken } from "@/lib/tier";
import {
  parseStatusPageBody,
  ownsAllMonitors,
  replacePageMonitors,
} from "@/lib/statusPages";
import type { StatusPageRow, StatusPageMonitorRow } from "@/lib/types";

// GET /api/status-pages - owner's pages with their monitor selections.
export async function GET(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const db = getDB();

  const { results: pages } = await db
    .prepare(
      "SELECT * FROM status_pages WHERE owner_token = ?1 ORDER BY created_at DESC",
    )
    .bind(token)
    .all<StatusPageRow>();

  const { results: links } = await db
    .prepare(
      `SELECT spm.* FROM status_page_monitors spm
        JOIN status_pages p ON p.id = spm.page_id
       WHERE p.owner_token = ?1
       ORDER BY spm.sort_order`,
    )
    .bind(token)
    .all<StatusPageMonitorRow>();

  const byPage = new Map<string, StatusPageMonitorRow[]>();
  for (const l of links ?? []) {
    const arr = byPage.get(l.page_id) ?? [];
    arr.push(l);
    byPage.set(l.page_id, arr);
  }

  return ok({
    pages: (pages ?? []).map((p) => ({ ...p, monitors: byPage.get(p.id) ?? [] })),
  });
}

// POST /api/status-pages - create a page. Enforces page count + monitors-per-page.
export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }
  const parsed = parseStatusPageBody(body);
  if ("error" in parsed) return badRequest(parsed.error);

  const db = getDB();
  const env = getEnv();
  const { limits } = await getLimitsForToken(db, token, env);

  const countRow = await db
    .prepare("SELECT COUNT(*) AS n FROM status_pages WHERE owner_token = ?1")
    .bind(token)
    .first<{ n: number }>();
  if ((countRow?.n ?? 0) >= limits.maxStatusPages) {
    return forbidden(
      `Status page limit reached (${limits.maxStatusPages}). Upgrade to Pro for more.`,
    );
  }
  if (parsed.monitors.length > limits.maxMonitorsPerStatusPage) {
    return forbidden(
      `A status page can show at most ${limits.maxMonitorsPerStatusPage} monitors on your plan.`,
    );
  }
  if (!(await ownsAllMonitors(db, token, parsed.monitors.map((m) => m.monitor_id)))) {
    return badRequest("One or more monitors do not exist");
  }

  // Free tier always shows the badge.
  const showPoweredBy = limits.canHidePoweredBy ? parsed.showPoweredBy : true;

  const now = Date.now();
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        `INSERT INTO status_pages (id, owner_token, slug, title, description, created_at, show_powered_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(id, token, parsed.slug, parsed.title, parsed.description, now, showPoweredBy ? 1 : 0)
      .run();
  } catch (err) {
    if (String(err).includes("UNIQUE")) return badRequest("Slug already taken");
    throw err;
  }

  await replacePageMonitors(db, id, parsed.monitors);

  const row = await db
    .prepare("SELECT * FROM status_pages WHERE id = ?1")
    .bind(id)
    .first<StatusPageRow>();
  return created({ page: row });
}
