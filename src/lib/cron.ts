import { sendEmail } from "@/lib/email";
import { getCronConcurrency, getPingTimeoutMs, getLimits } from "@/config/limits";
import type { MonitorRow } from "@/lib/types";

/**
 * ★ THE MONITOR CRON LOOP — runs once per minute from a SINGLE Cloudflare
 * Cron Trigger (see wrangler.toml + src/worker.ts scheduled()).
 *
 * Why one cron for everything: Cloudflare's free tier allows only 5 cron
 * triggers per account, so we MUST NOT create one trigger per monitor.
 * Instead this single tick:
 *   1. selects every monitor that is "due" (interval elapsed since
 *      last_checked_at, and not expired),
 *   2. pings each one with a timeout, recording a `checks` row,
 *   3. updates the monitor's is_up / last_status / last_checked_at,
 *   4. emails on a state TRANSITION (up->down or down->up) — not every
 *      failing check, to avoid alert spam,
 *   5. prunes old `checks` rows to the tier's history limit.
 *
 * Resilience: each monitor is wrapped in try/catch so one bad target can't
 * kill the batch. Concurrency is capped (CRON_CONCURRENCY) to respect the
 * Worker's CPU/subrequest budget.
 */

interface CronEnv {
  DB: D1Database;
  RESEND_API_KEY?: string;
  ALERT_FROM_EMAIL?: string;
  APP_URL?: string;
  [key: string]: unknown;
}

export interface CronResult {
  due: number;
  checked: number;
  failed: number;
  alertsSent: number;
}

export async function runMonitorCron(env: CronEnv): Promise<CronResult> {
  const db = env.DB;
  const now = Date.now();

  // ── 1. Find due monitors ──
  // Due when: never checked, OR (now - last_checked_at) >= interval.
  // We compute the threshold in SQL using interval_minutes * 60000 ms.
  // Also skip expired free resources (expires_at in the past).
  const { results: due } = await db
    .prepare(
      `SELECT * FROM monitors
        WHERE (expires_at IS NULL OR expires_at > ?1)
          AND (
            last_checked_at IS NULL
            OR ?1 - last_checked_at >= interval_minutes * 60000
          )`,
    )
    .bind(now)
    .all<MonitorRow>();

  const monitors = due ?? [];
  const result: CronResult = {
    due: monitors.length,
    checked: 0,
    failed: 0,
    alertsSent: 0,
  };
  if (monitors.length === 0) return result;

  const concurrency = getCronConcurrency(env);
  const timeoutMs = getPingTimeoutMs(env);

  // ── 2–5. Process in capped-concurrency batches ──
  for (let i = 0; i < monitors.length; i += concurrency) {
    const batch = monitors.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map((m) => processMonitor(db, env, m, timeoutMs)),
    );
    for (const s of settled) {
      if (s.status === "fulfilled") {
        result.checked++;
        if (!s.value.ok) result.failed++;
        if (s.value.alertSent) result.alertsSent++;
      } else {
        // Should be rare — processMonitor swallows its own errors. Counted
        // so the tick still returns and other monitors aren't affected.
        result.failed++;
      }
    }
  }

  return result;
}

interface ProcessOutcome {
  ok: boolean;
  alertSent: boolean;
}

async function processMonitor(
  db: D1Database,
  env: CronEnv,
  m: MonitorRow,
  timeoutMs: number,
): Promise<ProcessOutcome> {
  const now = Date.now();
  let statusCode: number | null = null;
  let responseTimeMs: number | null = null;
  let ok = false;

  // ── Ping with timeout. Any throw => treated as down (ok=false). ──
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    try {
      const res = await fetch(m.target_url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "Stubby-Monitor/1.0 (+https://stubby.dev)" },
      });
      responseTimeMs = Date.now() - started;
      statusCode = res.status;
      // 2xx (and 3xx redirects, since redirect:manual) counts as up.
      ok = res.status >= 200 && res.status < 400;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Timeout / DNS / connection error => down. statusCode stays null.
    ok = false;
  }

  const wasUp = m.is_up === 1;
  const nowUp = ok;
  const transition = wasUp !== nowUp; // up<->down change

  // ── Persist: record the check, update monitor state. ──
  // Each statement guarded so a write hiccup doesn't abort the whole tick.
  try {
    await db
      .prepare(
        `INSERT INTO checks (id, monitor_id, checked_at, status_code, response_time_ms, ok)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(crypto.randomUUID(), m.id, now, statusCode, responseTimeMs, nowUp ? 1 : 0)
      .run();

    await db
      .prepare(
        `UPDATE monitors SET last_checked_at=?1, last_status=?2, is_up=?3 WHERE id=?4`,
      )
      .bind(now, statusCode, nowUp ? 1 : 0, m.id)
      .run();

    // Prune old checks beyond the (free-tier) history limit. We use the free
    // limit as the storage cap; Pro reads more but we still bound rows.
    const historyLimit = getLimits("pro", env).historyLimit;
    await db
      .prepare(
        `DELETE FROM checks
          WHERE monitor_id = ?1
            AND id NOT IN (
              SELECT id FROM checks WHERE monitor_id = ?1
              ORDER BY checked_at DESC LIMIT ?2
            )`,
      )
      .bind(m.id, historyLimit)
      .run();
  } catch {
    // Swallow — reporting this monitor as processed; next tick retries.
  }

  // ── Alert on transition only. ──
  let alertSent = false;
  if (transition) {
    const sent = await sendTransitionEmail(env, m, nowUp, statusCode);
    alertSent = sent;
  }

  return { ok: nowUp, alertSent };
}

async function sendTransitionEmail(
  env: CronEnv,
  m: MonitorRow,
  nowUp: boolean,
  statusCode: number | null,
): Promise<boolean> {
  const appUrl = env.APP_URL ?? "";
  const statusText = statusCode != null ? `HTTP ${statusCode}` : "no response (timeout)";
  const subject = nowUp
    ? `✅ Recovered: ${m.target_url}`
    : `🔴 Down: ${m.target_url}`;
  const html = nowUp
    ? `<p>Good news — <a href="${m.target_url}">${m.target_url}</a> is back up (${statusText}).</p>
       <p style="color:#888">Monitored by Stubby. ${appUrl}/monitor</p>`
    : `<p><strong><a href="${m.target_url}">${m.target_url}</a> is down.</strong></p>
       <p>Last check returned ${statusText}.</p>
       <p style="color:#888">You'll get another email when it recovers. — Stubby ${appUrl}/monitor</p>`;

  const res = await sendEmail(env, { to: m.alert_email, subject, html });
  return res.ok;
}
