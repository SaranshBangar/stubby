import { getEnv } from "@/lib/db";
import { getOrder } from "@/lib/cashfree";
import { ok, badRequest } from "@/lib/http";

/** GET /api/verify-payment?order_id=xxx — poll order status after redirect back. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order_id");
  if (!orderId) return badRequest("Missing order_id");

  const env = getEnv() as Record<string, string | undefined>;
  const appId = env.CASHFREE_APP_ID;
  const secretKey = env.CASHFREE_SECRET_KEY;
  if (!appId || !secretKey) return badRequest("Cashfree not configured");

  const order = await getOrder({ appId, secretKey, orderId });
  return ok({ order_status: order.order_status });
}
