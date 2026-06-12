import { getEnv } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, unauthorized, badRequest } from "@/lib/http";
import { getStripe } from "@/lib/stripe";

/**
 * ★ STRIPE FLOW - step 1 of 3 (create Checkout session).
 *
 * The anonymous owner_token is the user's identity. To upgrade, we open a
 * Stripe Checkout session and stash that token in:
 *   - client_reference_id, and
 *   - subscription metadata,
 * so the webhook (step 3) can map the completed payment back to the token
 * and grant Pro. No email/password is collected by us - Stripe handles the
 * payment identity; the localStorage token stays the app identity.
 */
export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();

  const env = getEnv() as Record<string, string | undefined>;
  const secret = env.STRIPE_SECRET_KEY;
  const price = env.STRIPE_PRICE_ID;
  const appUrl = env.APP_URL ?? "http://localhost:3000";
  if (!secret || !price) {
    return badRequest("Stripe not configured (STRIPE_SECRET_KEY/STRIPE_PRICE_ID)");
  }

  const stripe = getStripe(secret);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    // Link this payment to the anonymous token (read back in the webhook).
    client_reference_id: token,
    subscription_data: { metadata: { owner_token: token } },
    metadata: { owner_token: token },
    success_url: `${appUrl}/mock?upgraded=1`,
    cancel_url: `${appUrl}/#pricing`,
  });

  return ok({ url: session.url });
}
