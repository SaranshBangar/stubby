/**
 * Cashfree Payment Gateway helper.
 * Uses direct REST API calls (no SDK) — safe for Cloudflare Workers edge runtime.
 */

const CASHFREE_BASE = "https://api.cashfree.com/pg";
const CF_VERSION = "2025-01-01";

export interface CashfreeOrder {
  cf_order_id: number;
  order_id: string;
  order_status: string;
  payment_session_id: string;
}

export async function createOrder(opts: {
  appId: string;
  secretKey: string;
  ownerToken: string;
  amount: number;
  returnUrl: string;
  webhookUrl: string;
}): Promise<CashfreeOrder> {
  const orderId = `stubby_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

  const res = await fetch(`${CASHFREE_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": opts.appId,
      "x-client-secret": opts.secretKey,
      "x-api-version": CF_VERSION,
    },
    body: JSON.stringify({
      order_id: orderId,
      order_amount: opts.amount,
      order_currency: "INR",
      customer_details: {
        // tok_<base64url> fits within 50 chars and uses only allowed chars (a-z,A-Z,0-9,-,_).
        customer_id: opts.ownerToken.slice(0, 50),
        customer_phone: "9999999999",
      },
      order_meta: {
        return_url: opts.returnUrl,
        notify_url: opts.webhookUrl,
      },
      order_tags: {
        owner_token: opts.ownerToken,
      },
      order_note: "Stubby Pro - Lifetime Access",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cashfree createOrder failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function getOrder(opts: {
  appId: string;
  secretKey: string;
  orderId: string;
}): Promise<{ order_id: string; order_status: string; order_tags?: Record<string, string> }> {
  const res = await fetch(`${CASHFREE_BASE}/orders/${opts.orderId}`, {
    headers: {
      "x-client-id": opts.appId,
      "x-client-secret": opts.secretKey,
      "x-api-version": CF_VERSION,
    },
  });
  if (!res.ok) throw new Error(`Cashfree getOrder failed: ${res.status}`);
  return res.json();
}

/** HMAC-SHA256 webhook signature verification using Web Crypto (edge-compatible). */
export async function verifyWebhookSignature(
  timestamp: string,
  rawBody: string,
  signature: string,
  secretKey: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(timestamp + rawBody));
  const computed = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return computed === signature;
}
