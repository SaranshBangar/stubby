/**
 * sendEmail() - provider-agnostic email helper.
 *
 * Currently wraps Resend's HTTP API (no SDK; plain fetch keeps the Worker
 * bundle tiny and edge-compatible). To swap providers, replace the body of
 * sendEmail and keep the signature - callers (the cron alert path) don't
 * care who delivers the mail.
 */

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailEnv {
  RESEND_API_KEY?: string;
  ALERT_FROM_EMAIL?: string;
}

export async function sendEmail(
  env: EmailEnv,
  { to, subject, html, text }: SendEmailArgs,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.ALERT_FROM_EMAIL;

  if (!apiKey || !from) {
    // Don't throw in the cron loop - degrade gracefully and report.
    return { ok: false, error: "Email not configured (RESEND_API_KEY/ALERT_FROM_EMAIL)" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text: text ?? stripHtml(html),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${detail}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
