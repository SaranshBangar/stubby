import { getDB } from "@/lib/db";
import { badRequest, json, unauthorized } from "@/lib/http";
import {
  verifyPassword,
  createSession,
  sessionCookie,
  isSecureRequest,
  normalizeEmail,
  toPublicUser,
  type UserRow,
} from "@/lib/auth";

/**
 * POST /api/auth/login - email+password sign-in.
 *
 * On success returns the account's canonical owner_token; the client stores it
 * in localStorage so every existing x-owner-token API call reads this account's
 * rows -> the same mocks/monitors/etc. appear on this device. Also sets the
 * httpOnly session cookie.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const email = normalizeEmail(body.email);
  if (!email || typeof body.password !== "string") {
    return unauthorized("Invalid email or password");
  }

  const db = getDB();
  const user = await db
    .prepare("SELECT * FROM users WHERE email = ?1 LIMIT 1")
    .bind(email)
    .first<UserRow>();

  // Same response whether the email is unknown or the password is wrong -
  // don't reveal which accounts exist.
  if (!user || !(await verifyPassword(body.password, user.password_hash))) {
    return unauthorized("Invalid email or password");
  }

  const { token } = await createSession(db, user.id);
  return json(
    { user: toPublicUser(user) },
    { status: 200, headers: { "set-cookie": sessionCookie(token, isSecureRequest(req)) } },
  );
}
