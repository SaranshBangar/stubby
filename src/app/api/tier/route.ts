import { getDB } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok } from "@/lib/http";
import { getTier } from "@/lib/tier";

/**
 * GET /api/tier — resolves the current owner_token's tier ("free" | "pro").
 *
 * Token-based (not session-based) so it covers BOTH an anonymous token that
 * paid and a logged-in account: tier is always keyed on owner_token. The
 * header polls this to show the Pro badge / hide the "Go Pro" CTA.
 */
export async function GET(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return ok({ tier: "free" });
  const tier = await getTier(getDB(), token);
  return ok({ tier });
}
