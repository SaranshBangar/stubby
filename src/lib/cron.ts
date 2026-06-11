import { sendEmail } from "@/lib/email";
import { checkSslCertificate } from "@/lib/ssl";
import {
  getCronConcurrency,
  getPingTimeoutMs,
  getLimits,
  SSL_EVENTS_HISTORY_LIMIT,
} from "@/config/limits";
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

/**
 * ★ THE single cron tick — entry point called from src/worker.ts. Every
 * scheduled job lives here (free tier caps cron triggers at 5/account, so
 * we never add another trigger):
 *   1. the monitor uptime loop (runMonitorCron),
 *   2. webhook inspector retention (expired endpoints + overflow requests).
 * Each step is independently try/caught — one failing subsystem must not
 * starve the others.
 */
export async function runCron(env: CronEnv): Promise<CronResult> {
  let result: CronResult = { due: 0, checked: 0, failed: 0, alertsSent: 0 };

  try {
    result = await runMonitorCron(env);
  } catch (e) {
    console.error("[cron] monitor loop failed", e);
  }

  try {
    await pruneWebhookData(env);
  } catch (e) {
    console.error("[cron] webhook retention failed", e);
  }

  return result;
}

/**
 * Webhook Inspector retention:
 *   1. delete expired endpoints (requests cascade via FK),
 *   2. for each remaining endpoint over its tier's stored-request limit,
 *      drop the oldest rows beyond the limit.
 */
async function pruneWebhookData(env: CronEnv): Promise<void> {
  const db = env.DB;
  const now = Date.now();

  await db
    .prepare(
      "DELETE FROM webhook_endpoints WHERE expires_at IS NOT NULL AND expires_at <= ?1",
    )
    .bind(now)
    .run();

  // Endpoints that exceed even the smallest (free) limit; resolve the
  // owner's tier per endpoint (cached per token) and trim the overflow.
  const freeLimit = getLimits("free", env).webhookRequestsPerEndpoint;
  const { results } = await db
    .prepare(
      `SELECT e.id, e.owner_token, COUNT(r.id) AS n
         FROM webhook_endpoints e
         JOIN webhook_requests r ON r.endpoint_id = e.id
        GROUP BY e.id
       HAVING COUNT(r.id) > ?1`,
    )
    .bind(freeLimit)
    .all<{ id: string; owner_token: string; n: number }>();

  const tierLimit = new Map<string, number>();
  for (const e of results ?? []) {
    let limit = tierLimit.get(e.owner_token);
    if (limit == null) {
      const acct = await db
        .prepare("SELECT status FROM accounts WHERE owner_token = ?1 LIMIT 1")
        .bind(e.owner_token)
        .first<{ status: string }>();
      const tier = acct?.status === "active" ? "pro" : "free";
      limit = getLimits(tier, env).webhookRequestsPerEndpoint;
      tierLimit.set(e.owner_token, limit);
    }
    if (e.n <= limit) continue;
    await db
      .prepare(
        `DELETE FROM webhook_requests
          WHERE endpoint_id = ?1
            AND id NOT IN (
              SELECT id FROM webhook_requests WHERE endpoint_id = ?1
              ORDER BY received_at DESC LIMIT ?2
            )`,
      )
      .bind(e.id, limit)
      .run();
  }
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

  // ── SSL inspection (HTTPS only). Fully independent of the uptime result:
  // a TLS problem must never mark the monitor down, and an inspection crash
  // must never lose the check we just recorded. ──
  if (m.target_url.startsWith("https://")) {
    try {
      if (await processSslCheck(db, env, m, now, timeoutMs)) alertSent = true;
    } catch (e) {
      console.error(`[cron] ssl check failed for ${m.id}`, e);
    }
  }

  return { ok: nowUp, alertSent };
}

/**
 * Inspect the monitor's TLS certificate, persist the result, and send the
 * tiered expiry/invalid alerts. Returns true if any alert email went out.
 *
 * Alert ladder: one email per threshold (30/14/7 days). If a cert is first
 * seen already inside a lower threshold we send only the most urgent email
 * and mark the higher thresholds as sent too — never three emails at once.
 * All flags reset once days_remaining climbs back above 30 (cert renewed).
 */
async function processSslCheck(
  db: D1Database,
  env: CronEnv,
  m: MonitorRow,
  now: number,
  timeoutMs: number,
): Promise<boolean> {
  const url = new URL(m.target_url);
  const port = url.port ? parseInt(url.port, 10) : 443;
  const result = await checkSslCertificate(url.hostname, port, timeoutMs);

  // Runtime can't introspect TLS (e.g. local workerd without node:tls) —
  // skip silently rather than recording a misleading "invalid" event.
  if (!result.supported) return false;

  const daysRemaining =
    result.validTo != null
      ? Math.floor((result.validTo - now) / 86_400_000)
      : null;

  await db
    .prepare(
      `UPDATE monitors
          SET ssl_expiry_date=?1, ssl_last_checked_at=?2, ssl_issuer=?3, ssl_days_remaining=?4
        WHERE id=?5`,
    )
    .bind(result.validTo, now, result.issuer, daysRemaining, m.id)
    .run();

  await db
    .prepare(
      `INSERT INTO ssl_events (id, monitor_id, checked_at, days_remaining, issuer, valid, error)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      crypto.randomUUID(),
      m.id,
      now,
      daysRemaining,
      result.issuer,
      result.valid ? 1 : 0,
      result.error,
    )
    .run();

  await db
    .prepare(
      `DELETE FROM ssl_events
        WHERE monitor_id = ?1
          AND id NOT IN (
            SELECT id FROM ssl_events WHERE monitor_id = ?1
            ORDER BY checked_at DESC LIMIT ?2
          )`,
    )
    .bind(m.id, SSL_EVENTS_HISTORY_LIMIT)
    .run();

  const domain = url.hostname;
  const appUrl = env.APP_URL ?? "";
  let sent = false;

  if (!result.valid) {
    if (m.ssl_invalid_alerted !== 1) {
      const expired = daysRemaining != null && daysRemaining < 0;
      const email = expired
        ? sslExpiredEmail(domain, appUrl)
        : sslInvalidEmail(domain, result.error ?? "Unknown TLS error", appUrl);
      const res = await sendEmail(env, { to: m.alert_email, ...email });
      sent = res.ok;
      await db
        .prepare("UPDATE monitors SET ssl_invalid_alerted=1 WHERE id=?1")
        .bind(m.id)
        .run();
    }
    return sent;
  }

  // Cert is valid again — clear the invalid flag so a future breakage alerts.
  if (m.ssl_invalid_alerted === 1) {
    await db
      .prepare("UPDATE monitors SET ssl_invalid_alerted=0 WHERE id=?1")
      .bind(m.id)
      .run();
  }

  if (daysRemaining == null) return sent;

  if (daysRemaining > 30) {
    // Renewed — re-arm all expiry thresholds.
    if (m.ssl_alert_sent_30 === 1 || m.ssl_alert_sent_14 === 1 || m.ssl_alert_sent_7 === 1) {
      await db
        .prepare(
          "UPDATE monitors SET ssl_alert_sent_30=0, ssl_alert_sent_14=0, ssl_alert_sent_7=0 WHERE id=?1",
        )
        .bind(m.id)
        .run();
    }
    return sent;
  }

  let flagsSql: string | null = null;
  if (daysRemaining <= 7 && m.ssl_alert_sent_7 !== 1) {
    flagsSql = "ssl_alert_sent_7=1, ssl_alert_sent_14=1, ssl_alert_sent_30=1";
  } else if (daysRemaining <= 14 && m.ssl_alert_sent_14 !== 1) {
    flagsSql = "ssl_alert_sent_14=1, ssl_alert_sent_30=1";
  } else if (daysRemaining <= 30 && m.ssl_alert_sent_30 !== 1) {
    flagsSql = "ssl_alert_sent_30=1";
  }
  if (flagsSql) {
    const res = await sendEmail(env, {
      to: m.alert_email,
      ...sslExpiryWarningEmail(domain, daysRemaining, appUrl),
    });
    sent = res.ok || sent;
    await db
      .prepare(`UPDATE monitors SET ${flagsSql} WHERE id=?1`)
      .bind(m.id)
      .run();
  }

  return sent;
}

// ── SSL alert email templates ──────────────────────────────────────────

function sslExpiryWarningEmail(domain: string, days: number, appUrl: string) {
  return {
    subject: `SSL cert for ${domain} expires in ${days} day${days === 1 ? "" : "s"}`,
    html: `<p>The SSL certificate for <strong>${domain}</strong> expires in <strong>${days} day${days === 1 ? "" : "s"}</strong>.</p>
       <p>Once it expires, browsers will show a security warning and refuse to load the site. Renew the certificate before then (most providers, like Let's Encrypt, renew automatically — this may mean the automation is broken).</p>
       <p style="color:#888">Monitored by Stubby. <a href="${appUrl}/monitor">${appUrl}/monitor</a></p>`,
  };
}

function sslExpiredEmail(domain: string, appUrl: string) {
  return {
    subject: `SSL cert for ${domain} has expired`,
    html: `<p>The SSL certificate for <strong>${domain}</strong> <strong>has expired</strong>.</p>
       <p>Visitors are now seeing browser security warnings and most clients will refuse to connect. Renew the certificate as soon as possible.</p>
       <p style="color:#888">You'll only get this email once per incident. — Stubby <a href="${appUrl}/monitor">${appUrl}/monitor</a></p>`,
  };
}

function sslInvalidEmail(domain: string, error: string, appUrl: string) {
  return {
    subject: `SSL certificate error on ${domain}`,
    html: `<p>The SSL certificate for <strong>${domain}</strong> failed validation: <code>${error}</code></p>
       <p>This usually means a broken certificate chain, a self-signed cert, or a hostname mismatch. Clients that validate certificates (browsers, most HTTP libraries) will refuse to connect.</p>
       <p style="color:#888">You'll only get this email once per incident. — Stubby <a href="${appUrl}/monitor">${appUrl}/monitor</a></p>`,
  };
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
