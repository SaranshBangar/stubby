import { getDB } from "@/lib/db";
import { json } from "@/lib/http";
import {
  destroySession,
  clearCookie,
  isSecureRequest,
  readCookie,
  SESSION_COOKIE,
} from "@/lib/auth";

/**
 * POST /api/auth/logout - end the session.
 *
 * Deletes the session row and clears the cookie. The client also drops its
 * stored owner_token and mints a fresh anonymous one, so the device reverts to
 * a clean anonymous identity (no residual access to the account's resources on
 * shared machines).
 */
export async function POST(req: Request) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) {
    try {
      await destroySession(getDB(), token);
    } catch {
      // Best-effort: clearing the cookie below still logs the client out.
    }
  }
  return json(
    { ok: true },
    { headers: { "set-cookie": clearCookie(SESSION_COOKIE, isSecureRequest(req)) } },
  );
}
