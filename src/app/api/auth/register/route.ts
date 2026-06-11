import { getDB } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { badRequest, json } from "@/lib/http";
import {
  hashPassword,
  createSession,
  sessionCookie,
  isSecureRequest,
  pickOwnerToken,
  normalizeEmail,
  isValidPassword,
  toPublicUser,
  type UserRow,
} from "@/lib/auth";

/**
 * POST /api/auth/register — email+password sign-up.
 *
 * Adopts the device's current anonymous owner_token (sent via x-owner-token)
 * as the account's canonical token, so work created before signup is kept and
 * now syncs across devices. Sets the httpOnly session cookie and returns the
 * canonical owner_token for the client to store in localStorage.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const email = normalizeEmail(body.email);
  if (!email) return badRequest("Invalid email");
  if (!isValidPassword(body.password)) {
    return badRequest("Password must be 8–200 characters");
  }

  const db = getDB();
  const existing = await db
    .prepare("SELECT 1 FROM users WHERE email = ?1 LIMIT 1")
    .bind(email)
    .first();
  if (existing) return badRequest("An account with that email already exists");

  const ownerToken = await pickOwnerToken(db, getTokenFromRequest(req));
  const passwordHash = await hashPassword(body.password as string);
  const now = Date.now();
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, google_sub, owner_token, created_at, updated_at)
       VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?5)`,
    )
    .bind(id, email, passwordHash, ownerToken, now)
    .run();

  const user: UserRow = {
    id,
    email,
    password_hash: passwordHash,
    google_sub: null,
    owner_token: ownerToken,
    created_at: now,
    updated_at: now,
  };

  const { token } = await createSession(db, id);
  return json(
    { user: toPublicUser(user) },
    { status: 201, headers: { "set-cookie": sessionCookie(token, isSecureRequest(req)) } },
  );
}
