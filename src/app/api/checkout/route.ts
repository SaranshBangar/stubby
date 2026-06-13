import { getEnv } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, unauthorized, badRequest } from "@/lib/http";
import { createOrder } from "@/lib/cashfree";

/**
 * Creates a Cashfree order for one-time ₹99 lifetime Pro purchase.
 * Returns { payment_session_id, order_id } which the frontend uses with
 * Cashfree.js Drop-in to open the payment checkout.
 */
export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();

  const env = getEnv() as Record<string, string | undefined>;
  const appId = env.CASHFREE_APP_ID;
  const secretKey = env.CASHFREE_SECRET_KEY;
  const appUrl = env.APP_URL ?? "http://localhost:3000";

  if (!appId || !secretKey) {
    return badRequest("Cashfree not configured (CASHFREE_APP_ID / CASHFREE_SECRET_KEY)");
  }

  // Cashfree requires https for return_url / notify_url. On local dev
  // (http://localhost) fall back to the production https origin so order
  // creation succeeds — the local flow then polls /api/verify-payment instead
  // of relying on a Cashfree-delivered webhook (Cashfree can't reach localhost).
  const publicBase = appUrl.startsWith("https://") ? appUrl : "https://stubby.site";

  const order = await createOrder({
    appId,
    secretKey,
    ownerToken: token,
    amount: 99,
    returnUrl: `${publicBase}/mock?upgraded=1`,
    webhookUrl: `${publicBase}/api/cashfree/webhook`,
  });

  return ok({
    payment_session_id: order.payment_session_id,
    order_id: order.order_id,
  });
}
