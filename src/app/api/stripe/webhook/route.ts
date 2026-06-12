import type Stripe from "stripe";
import { getDB, getEnv } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

/**
 * ★ STRIPE FLOW - steps 2 & 3 (webhook: unlock / revoke Pro).
 *
 * Stripe calls this endpoint on subscription lifecycle events. We:
 *   1. verify the signature (constructEventAsync - edge/Web-Crypto safe),
 *   2. read owner_token from the session/subscription metadata,
 *   3. upsert a row in `accounts` so tier.ts treats that token as Pro
 *      (status 'active'), or flips it to 'canceled' on cancellation.
 *
 * The same localStorage token the user already has becomes Pro - nothing for
 * them to "log into". To support a user switching browsers later, you'd add a
 * "restore" flow (email a magic link carrying the token); out of scope here.
 */
export async function POST(req: Request) {
  const env = getEnv() as Record<string, string | undefined>;
  const secret = env.STRIPE_SECRET_KEY;
  const whSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !whSecret) {
    return new Response("Stripe not configured", { status: 500 });
  }

  const stripe = getStripe(secret);
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const raw = await req.text(); // raw body required for signature verification
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, whSecret);
  } catch (err) {
    return new Response(`Invalid signature: ${String(err)}`, { status: 400 });
  }

  const db = getDB();
  const now = Date.now();

  try {
    switch (event.type) {
      // Payment done -> grant Pro.
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const token = s.client_reference_id ?? s.metadata?.owner_token;
        if (token) {
          await upsertAccount(db, {
            token,
            customer: typeof s.customer === "string" ? s.customer : null,
            sub: typeof s.subscription === "string" ? s.subscription : null,
            status: "active",
            now,
          });
        }
        break;
      }

      // Keep status in sync (renewals, past_due, cancellation).
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const token = sub.metadata?.owner_token;
        if (token) {
          const status =
            sub.status === "active" || sub.status === "trialing"
              ? "active"
              : event.type === "customer.subscription.deleted"
                ? "canceled"
                : sub.status; // 'past_due', etc.
          await upsertAccount(db, {
            token,
            customer: typeof sub.customer === "string" ? sub.customer : null,
            sub: sub.id,
            status,
            now,
          });
        }
        break;
      }

      default:
        break; // ignore other events
    }
  } catch (err) {
    // Return 500 so Stripe retries on a transient DB error.
    return new Response(`Handler error: ${String(err)}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function upsertAccount(
  db: D1Database,
  a: {
    token: string;
    customer: string | null;
    sub: string | null;
    status: string;
    now: number;
  },
) {
  // owner_token is UNIQUE - upsert on conflict.
  await db
    .prepare(
      `INSERT INTO accounts (id, owner_token, stripe_customer, stripe_sub, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
       ON CONFLICT(owner_token) DO UPDATE SET
         stripe_customer = excluded.stripe_customer,
         stripe_sub      = excluded.stripe_sub,
         status          = excluded.status,
         updated_at      = excluded.updated_at`,
    )
    .bind(crypto.randomUUID(), a.token, a.customer, a.sub, a.status, a.now)
    .run();
}
