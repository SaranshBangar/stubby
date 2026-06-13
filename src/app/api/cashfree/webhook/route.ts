import { getDB, getEnv } from "@/lib/db";
import { verifyWebhookSignature, getOrder } from "@/lib/cashfree";
import { sendProWelcomeEmail } from "@/lib/proWelcome";

/**
 * Cashfree webhook — receives PAYMENT_SUCCESS_WEBHOOK and grants Pro.
 *
 * Security & response contract:
 *   1. Verify the HMAC-SHA256 signature (x-webhook-timestamp + raw body) — this
 *      authenticates the request as genuinely from Cashfree. A bad/missing
 *      signature is the ONLY case that returns a non-2xx (400).
 *   2. Once the signature is valid we ALWAYS acknowledge with 200, even if the
 *      payload is a dashboard test ping, an unrelated event, or an order we
 *      can't re-fetch. Returning 5xx here would make Cashfree mark delivery as
 *      failed and retry noisily (and makes the dashboard "Test" button fail).
 *   3. We grant Pro only when the order INDEPENDENTLY confirms PAID via
 *      GET /orders/{order_id}. The owner_token comes from order_tags (set at
 *      order creation), falling back to customer_id.
 */
function ack(extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ received: true, ...extra }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  const env = getEnv() as Record<string, string | undefined>;
  const secretKey = env.CASHFREE_SECRET_KEY;
  if (!secretKey) return new Response("Cashfree not configured", { status: 500 });

  const sig = req.headers.get("x-webhook-signature");
  const timestamp = req.headers.get("x-webhook-timestamp");
  if (!sig || !timestamp) return new Response("Missing signature headers", { status: 400 });

  const raw = await req.text();

  const valid = await verifyWebhookSignature(timestamp, raw, sig, secretKey);
  if (!valid) return new Response("Invalid signature", { status: 400 });

  // Signature is valid → from here on we always acknowledge with 200.
  let payload: {
    type: string;
    data?: {
      order?: { order_id?: string; order_tags?: Record<string, string> };
      payment?: { payment_status?: string };
      customer_details?: { customer_id?: string };
    };
  };

  try {
    payload = JSON.parse(raw);
  } catch {
    return ack({ ignored: "invalid_json" });
  }

  if (payload.type !== "PAYMENT_SUCCESS_WEBHOOK") {
    return ack({ ignored: payload.type ?? "unknown" });
  }

  const orderId = payload.data?.order?.order_id;
  const ownerToken =
    payload.data?.order?.order_tags?.owner_token ??
    payload.data?.customer_details?.customer_id;

  const appId = env.CASHFREE_APP_ID;
  if (!orderId || !ownerToken || !appId) {
    // Test ping / sample payload without a real order — acknowledge, don't grant.
    return ack({ granted: false, reason: "incomplete_payload" });
  }

  // Re-verify order status before granting Pro. A fetch failure (e.g. a dummy
  // test order that doesn't exist) is not fatal — acknowledge without granting.
  let orderStatus: string;
  try {
    const order = await getOrder({ appId, secretKey, orderId });
    orderStatus = order.order_status;
  } catch {
    return ack({ granted: false, reason: "order_not_verifiable" });
  }

  if (orderStatus !== "PAID") {
    return ack({ granted: false, reason: `order_${orderStatus}` });
  }

  const db = getDB();
  const now = Date.now();

  // Was this token already Pro? Used to send the welcome email only on the
  // first activation (webhook retries / repeat events won't re-send it).
  let wasActive = false;
  try {
    const prior = await db
      .prepare("SELECT status FROM accounts WHERE owner_token = ?1 LIMIT 1")
      .bind(ownerToken)
      .first<{ status: string }>();
    wasActive = prior?.status === "active";
  } catch {
    // Non-fatal — fall through and treat as a new activation.
  }

  try {
    await db
      .prepare(
        `INSERT INTO accounts (id, owner_token, cf_customer, cf_order_id, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?5)
         ON CONFLICT(owner_token) DO UPDATE SET
           cf_customer  = excluded.cf_customer,
           cf_order_id  = excluded.cf_order_id,
           status       = 'active',
           updated_at   = excluded.updated_at`,
      )
      .bind(
        crypto.randomUUID(),
        ownerToken,
        payload.data?.customer_details?.customer_id ?? null,
        orderId,
        now,
      )
      .run();
  } catch (err) {
    // DB error IS transient — return 500 so Cashfree retries delivery.
    return new Response(`DB error: ${String(err)}`, { status: 500 });
  }

  // Send the "Welcome to Pro" email only on first activation. Best-effort —
  // a mail failure must not fail the webhook (Pro is already granted).
  if (!wasActive) {
    await sendProWelcomeEmail(env, db, ownerToken).catch(() => {});
  }

  return ack({ granted: true });
}
