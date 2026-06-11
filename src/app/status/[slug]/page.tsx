import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDB } from "@/lib/db";
import type { StatusPageRow } from "@/lib/types";

/**
 * ★ The public status page — no auth, no owner_token anywhere in the
 * response. Rendered server-side per request straight from D1 so the
 * up/down state is live; everything else is static markup (cacheable by
 * any proxy in front).
 */

export const dynamic = "force-dynamic";

const DAYS = 90;
const DAY_MS = 86_400_000;

type Ctx = { params: Promise<{ slug: string }> };

interface PublicMonitor {
  monitor_id: string;
  display_label: string | null;
  sort_order: number;
  target_url: string;
  is_up: number;
  last_checked_at: number | null;
}

interface DayBucket {
  monitor_id: string;
  day: number;
  total: number;
  ok_n: number;
}

export async function generateMetadata({ params }: Ctx): Promise<Metadata> {
  const { slug } = await params;
  const page = await getDB()
    .prepare("SELECT title, description FROM status_pages WHERE slug = ?1")
    .bind(slug)
    .first<{ title: string; description: string }>();
  return {
    title: page?.title ?? "Status",
    description: page?.description || undefined,
    robots: { index: true, follow: true },
  };
}

export default async function PublicStatusPage({ params }: Ctx) {
  const { slug } = await params;
  const db = getDB();
  const now = Date.now();

  // Select ONLY public fields — owner_token must never reach the render
  // path (anything the component touches can end up in the RSC payload).
  const page = await db
    .prepare(
      "SELECT id, slug, title, description, show_powered_by FROM status_pages WHERE slug = ?1",
    )
    .bind(slug)
    .first<
      Pick<StatusPageRow, "id" | "slug" | "title" | "description" | "show_powered_by">
    >();
  if (!page) notFound();

  const { results: monitors } = await db
    .prepare(
      `SELECT spm.monitor_id, spm.display_label, spm.sort_order,
              m.target_url, m.is_up, m.last_checked_at
         FROM status_page_monitors spm
         JOIN monitors m ON m.id = spm.monitor_id
        WHERE spm.page_id = ?1
        ORDER BY spm.sort_order`,
    )
    .bind(page.id)
    .all<PublicMonitor>();
  const list = monitors ?? [];

  // Per-day ok/total buckets over the window, for the sparkline + uptime %.
  const windowStart = now - DAYS * DAY_MS;
  let buckets: DayBucket[] = [];
  if (list.length > 0) {
    const placeholders = list.map((_, i) => `?${i + 2}`).join(",");
    const { results } = await db
      .prepare(
        `SELECT monitor_id,
                CAST(checked_at / ${DAY_MS} AS INTEGER) AS day,
                COUNT(*) AS total,
                SUM(ok) AS ok_n
           FROM checks
          WHERE checked_at >= ?1 AND monitor_id IN (${placeholders})
          GROUP BY monitor_id, day`,
      )
      .bind(windowStart, ...list.map((m) => m.monitor_id))
      .all<DayBucket>();
    buckets = results ?? [];
  }
  const byMonitor = new Map<string, Map<number, DayBucket>>();
  for (const b of buckets) {
    const m = byMonitor.get(b.monitor_id) ?? new Map<number, DayBucket>();
    m.set(b.day, b);
    byMonitor.set(b.monitor_id, m);
  }

  const today = Math.floor(now / DAY_MS);
  const upCount = list.filter((m) => m.is_up === 1).length;
  const overall =
    list.length === 0 || upCount === list.length
      ? ("ok" as const)
      : upCount === 0
        ? ("major" as const)
        : ("partial" as const);

  const overallStyles = {
    ok: { text: "All systems operational", cls: "bg-success/15 text-success" },
    partial: { text: "Partial outage", cls: "bg-warning/15 text-warning" },
    major: { text: "Major outage", cls: "bg-destructive/15 text-destructive" },
  }[overall];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-t1">
          {page.title}
        </h1>
        {page.description && (
          <p className="mt-1 text-sm text-t2">{page.description}</p>
        )}
        <div
          className={`mt-4 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${overallStyles.cls}`}
        >
          <span className="inline-block h-2 w-2 rounded-full bg-current" />
          {overallStyles.text}
        </div>
      </header>

      <main className="mt-8 space-y-4">
        {list.length === 0 && (
          <p className="text-sm text-t2">No monitors on this page yet.</p>
        )}
        {list.map((m) => {
          const days = byMonitor.get(m.monitor_id);
          let okSum = 0;
          let totalSum = 0;
          const bars: ("up" | "down" | "none")[] = [];
          for (let d = today - DAYS + 1; d <= today; d++) {
            const b = days?.get(d);
            if (!b || b.total === 0) {
              bars.push("none");
            } else {
              okSum += b.ok_n;
              totalSum += b.total;
              bars.push(b.ok_n === b.total ? "up" : "down");
            }
          }
          const uptimePct =
            totalSum > 0 ? ((okSum / totalSum) * 100).toFixed(2) : null;

          return (
            <section
              key={m.monitor_id}
              className="rounded-lg border border-border bg-s1 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 truncate text-sm font-medium text-t1">
                  {m.display_label || m.target_url}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    m.is_up === 1
                      ? "bg-success/15 text-success"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {m.is_up === 1 ? "Up" : "Down"}
                </span>
              </div>

              <div className="mt-3 flex h-8 items-stretch gap-px" aria-hidden>
                {bars.map((b, i) => (
                  <span
                    key={i}
                    className={`min-w-0 flex-1 rounded-[1px] ${
                      b === "up"
                        ? "bg-success/80"
                        : b === "down"
                          ? "bg-destructive/80"
                          : "bg-s3"
                    }`}
                  />
                ))}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-xs text-t2">
                <span>
                  {uptimePct != null
                    ? `${uptimePct}% uptime · last ${DAYS} days`
                    : `no data yet · last ${DAYS} days`}
                </span>
                <span>
                  last checked{" "}
                  {m.last_checked_at != null
                    ? new Date(m.last_checked_at).toLocaleString()
                    : "never"}
                </span>
              </div>
            </section>
          );
        })}
      </main>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-t3">
        <span>Last updated {new Date(now).toLocaleString()}</span>
        {page.show_powered_by === 1 && (
          <a href="/" className="hover:text-t1">
            Powered by <span className="font-mono text-brand">stub</span>
            <span className="font-mono">by</span>
          </a>
        )}
      </footer>
    </div>
  );
}
