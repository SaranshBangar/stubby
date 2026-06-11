import { sendEmail } from "@/lib/email";
import type { AlertChannelRow, MonitorRow } from "@/lib/types";

/**
 * ★ Multi-channel alert dispatch. One entry point — sendAlert() — fans an
 * alert out to the monitor's email (the original behavior) plus every
 * Slack / Discord / generic-webhook channel linked to the monitor.
 *
 * Resilience contract: every channel dispatch is independently try/caught
 * and logged to alert_delivery_log — one bad webhook URL must never stop
 * the email or the other channels.
 */

export type AlertEvent =
  | "down"
  | "up"
  | "keyword_failure"
  | "ssl_expiry"
  | "ssl_expired"
  | "ssl_invalid";

export interface AlertContent {
  event: AlertEvent;
  /** Short human explanation, e.g. "HTTP 503" or "Cert expires in 5 days". */
  details: string;
  emailSubject: string;
  emailHtml: string;
}

interface AlertEnv {
  RESEND_API_KEY?: string;
  ALERT_FROM_EMAIL?: string;
  APP_URL?: string;
  [key: string]: unknown;
}

const FETCH_TIMEOUT_MS = 10_000;

export async function sendAlert(
  db: D1Database,
  env: AlertEnv,
  monitor: MonitorRow,
  content: AlertContent,
): Promise<boolean> {
  let anySent = false;

  // 1. Email — existing behavior, kept first.
  try {
    const res = await sendEmail(env, {
      to: monitor.alert_email,
      subject: content.emailSubject,
      html: content.emailHtml,
    });
    anySent = res.ok;
  } catch (e) {
    console.error(`[alerts] email failed for monitor ${monitor.id}`, e);
  }

  // 2. Linked channels.
  let channels: AlertChannelRow[] = [];
  try {
    const { results } = await db
      .prepare(
        `SELECT c.* FROM alert_channels c
          JOIN monitor_alert_channels mac ON mac.channel_id = c.id
         WHERE mac.monitor_id = ?1`,
      )
      .bind(monitor.id)
      .all<AlertChannelRow>();
    channels = results ?? [];
  } catch (e) {
    console.error(`[alerts] channel lookup failed for monitor ${monitor.id}`, e);
  }

  for (const channel of channels) {
    const ok = await dispatchToChannel(db, channel, monitor, content);
    anySent = anySent || ok;
  }

  return anySent;
}

/** Send one message to one channel, logging the attempt. */
export async function dispatchToChannel(
  db: D1Database,
  channel: AlertChannelRow,
  monitor: MonitorRow | null,
  content: AlertContent,
): Promise<boolean> {
  let success = false;
  let error: string | null = null;

  try {
    const body = buildChannelPayload(channel.type, monitor, content);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(channel.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      success = res.ok;
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        error = `HTTP ${res.status}: ${detail.slice(0, 300)}`;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    error = String(e);
  }

  try {
    await db
      .prepare(
        `INSERT INTO alert_delivery_log (id, channel_id, monitor_id, attempted_at, success, error)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(
        crypto.randomUUID(),
        channel.id,
        monitor?.id ?? null,
        Date.now(),
        success ? 1 : 0,
        error,
      )
      .run();
  } catch (e) {
    console.error(`[alerts] delivery log write failed for channel ${channel.id}`, e);
  }

  return success;
}

function buildChannelPayload(
  type: AlertChannelRow["type"],
  monitor: MonitorRow | null,
  content: AlertContent,
): unknown {
  const label = monitor?.target_url ?? "Stubby";
  const when = new Date().toISOString();
  const line = `${eventEmoji(content.event)} ${label} — ${content.details} (${when})`;

  switch (type) {
    case "slack":
      return { text: line };
    case "discord":
      return { content: line };
    case "webhook":
      return {
        monitor_id: monitor?.id ?? null,
        monitor_label: label,
        event: content.event,
        url: monitor?.target_url ?? null,
        checked_at: when,
        details: content.details,
      };
  }
}

function eventEmoji(event: AlertEvent): string {
  switch (event) {
    case "up":
      return "✅";
    case "down":
      return "🔴";
    case "keyword_failure":
      return "🔍";
    default:
      return "🔒"; // ssl_*
  }
}
