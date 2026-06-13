import { sendEmail, type EmailEnv } from "@/lib/email";

/**
 * Send the "Welcome to Pro" email for a freshly-upgraded owner_token.
 *
 * Pro is keyed on an owner_token, which may be anonymous (no email on file) or
 * owned by a registered user. We look up the user's email; if there isn't one
 * (anonymous purchase), there's nobody to email — return silently. Best-effort:
 * never throws, so a mail hiccup can't break the payment grant.
 */
export async function sendProWelcomeEmail(
  env: EmailEnv,
  db: D1Database,
  ownerToken: string,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  let email: string | null = null;
  try {
    const row = await db
      .prepare("SELECT email FROM users WHERE owner_token = ?1 LIMIT 1")
      .bind(ownerToken)
      .first<{ email: string }>();
    email = row?.email ?? null;
  } catch (err) {
    return { ok: false, error: String(err) };
  }

  if (!email) return { ok: true, skipped: true }; // anonymous token, no recipient

  const name = email.split("@")[0];
  return sendEmail(env, {
    to: email,
    subject: "Welcome to the Stubby Pro club 🎉",
    html: welcomeHtml(name),
    text: welcomeText(name),
  });
}

function welcomeHtml(name: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;line-height:1.6">
    <div style="height:3px;background:#f26b21;border-radius:3px"></div>
    <h1 style="font-size:22px;margin:28px 0 8px">Welcome to the Pro club, ${escapeHtml(name)} 🎉</h1>
    <p style="font-size:15px;color:#444">
      Thank you so much for upgrading to <strong>Stubby Pro</strong> — it genuinely
      means a lot. You're now set up for life: <strong>one payment, Pro forever</strong>,
      no subscriptions, no renewals.
    </p>
    <p style="font-size:15px;color:#444;margin-bottom:6px">Here's everything that just unlocked for you:</p>
    <ul style="font-size:14.5px;color:#444;padding-left:20px;margin-top:0">
      <li>Persistent resources — your mocks, monitors &amp; webhooks never expire</li>
      <li>Up to 25 uptime + SSL monitors</li>
      <li>1-minute check intervals</li>
      <li>Slack, Discord &amp; multi-channel alerts</li>
      <li>Custom response headers</li>
      <li>500 stored webhook requests per endpoint</li>
      <li>Custom status pages — no Stubby branding</li>
    </ul>
    <p style="font-size:15px;color:#444">
      Everything is already live on your account — just head back to
      <a href="https://stubby.site/mock" style="color:#f26b21;text-decoration:none">stubby.site</a>
      and your new limits are in effect.
    </p>
    <p style="font-size:15px;color:#444">
      If you ever need anything, just reply to this email. Thank you for backing Stubby. 🧡
    </p>
    <p style="font-size:14px;color:#888;margin-top:28px">
      — The Stubby team
    </p>
  </div>`;
}

function welcomeText(name: string): string {
  return [
    `Welcome to the Pro club, ${name}!`,
    "",
    "Thank you so much for upgrading to Stubby Pro. One payment, Pro forever — no subscriptions, no renewals.",
    "",
    "Just unlocked:",
    "- Persistent resources (never expire)",
    "- Up to 25 uptime + SSL monitors",
    "- 1-minute check intervals",
    "- Slack, Discord & multi-channel alerts",
    "- Custom response headers",
    "- 500 stored webhook requests per endpoint",
    "- Custom status pages (no Stubby branding)",
    "",
    "Everything is already live — head back to https://stubby.site/mock.",
    "",
    "If you need anything, just reply to this email. Thank you for backing Stubby!",
    "",
    "— The Stubby team",
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
