import { isValidSlug } from "@/lib/slug";

// Shared validation for the status page create/update routes.

export interface StatusPageMonitorInput {
  monitor_id: string;
  display_label: string | null;
}

export interface ParsedStatusPage {
  title: string;
  description: string;
  slug: string;
  monitors: StatusPageMonitorInput[];
  showPoweredBy: boolean;
}

export function parseStatusPageBody(
  body: Record<string, unknown>,
): { error: string } | ParsedStatusPage {
  const title = String(body.title ?? "").trim();
  if (!title || title.length > 120) {
    return { error: "title is required (max 120 chars)" };
  }
  const description = String(body.description ?? "").trim().slice(0, 500);

  const slug = body.slug;
  if (!isValidSlug(slug)) {
    return { error: "slug must be lowercase letters/digits/hyphens (2–41 chars)" };
  }

  const rawMonitors = body.monitors;
  if (!Array.isArray(rawMonitors) || rawMonitors.length === 0) {
    return { error: "monitors must be a non-empty array" };
  }
  const monitors: StatusPageMonitorInput[] = [];
  const seen = new Set<string>();
  for (const m of rawMonitors) {
    const id = String((m as Record<string, unknown>)?.monitor_id ?? "");
    if (!id || seen.has(id)) {
      return { error: "monitors entries must have unique monitor_id" };
    }
    seen.add(id);
    const label = (m as Record<string, unknown>)?.display_label;
    monitors.push({
      monitor_id: id,
      display_label:
        label != null && String(label).trim() !== ""
          ? String(label).trim().slice(0, 80)
          : null,
    });
  }

  return {
    title,
    description,
    slug: slug as string,
    monitors,
    showPoweredBy: body.show_powered_by !== false,
  };
}

// All monitor_ids must belong to this token - no exposing someone else's
// monitor on your page.
export async function ownsAllMonitors(
  db: D1Database,
  token: string,
  monitorIds: string[],
): Promise<boolean> {
  if (monitorIds.length === 0) return false;
  const placeholders = monitorIds.map((_, i) => `?${i + 2}`).join(",");
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM monitors WHERE owner_token = ?1 AND id IN (${placeholders})`,
    )
    .bind(token, ...monitorIds)
    .first<{ n: number }>();
  return (row?.n ?? 0) === monitorIds.length;
}

// Replace a page's monitor selection (used by create + update).
export async function replacePageMonitors(
  db: D1Database,
  pageId: string,
  monitors: StatusPageMonitorInput[],
): Promise<void> {
  await db
    .prepare("DELETE FROM status_page_monitors WHERE page_id = ?1")
    .bind(pageId)
    .run();
  for (let i = 0; i < monitors.length; i++) {
    const m = monitors[i];
    await db
      .prepare(
        `INSERT INTO status_page_monitors (page_id, monitor_id, display_label, sort_order)
         VALUES (?1, ?2, ?3, ?4)`,
      )
      .bind(pageId, m.monitor_id, m.display_label, i)
      .run();
  }
}
