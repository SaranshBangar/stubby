import { getDB } from "@/lib/db";
import { ok } from "@/lib/http";
import { getUserFromRequest, toPublicUser } from "@/lib/auth";

/**
 * GET /api/auth/me - current user from the session cookie, or { user: null }.
 *
 * The client calls this on load: if a user is returned it adopts the account's
 * canonical owner_token (handles returning to a logged-in device after clearing
 * localStorage).
 */
export async function GET(req: Request) {
  const user = await getUserFromRequest(getDB(), req);
  return ok({ user: user ? toPublicUser(user) : null });
}
