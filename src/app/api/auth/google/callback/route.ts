import { getDB, getEnv } from "@/lib/db";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_ADOPT_COOKIE,
  SESSION_COOKIE,
  readCookie,
  shortCookie,
  sessionCookie,
  clearCookie,
  isSecureRequest,
  createSession,
  pickOwnerToken,
  normalizeEmail,
  type UserRow,
} from "@/lib/auth";

/**
 * GET /api/auth/google/callback - finish Google OAuth.
 *
 *   1. verify the `state` (CSRF) against the cookie set in /start,
 *   2. exchange the code for tokens (server-to-server over TLS),
 *   3. read the verified profile from Google's userinfo endpoint,
 *   4. link by google_sub, else by existing email, else create a new account
 *      (adopting the device's anonymous owner_token to keep pre-signup work),
 *   5. set the session cookie and bounce to the app. The client then calls
 *      /api/auth/me to adopt the canonical owner_token into localStorage.
 */
export async function GET(req: Request) {
  const env = getEnv() as Record<string, string | undefined>;
  const appUrl = env.APP_URL ?? new URL(req.url).origin;
  const secure = isSecureRequest(req);

  const fail = (msg: string) =>
    redirect(`${appUrl}/account?error=${encodeURIComponent(msg)}`, secure);

  // Never let an unexpected throw become a bare 500 that strands the user on
  // this callback URL - always bounce back to /account with a readable error.
  try {
    return await handleCallback(req, env, appUrl, secure, fail);
  } catch (err) {
    return fail(`Sign-in failed: ${String(err)}`);
  }
}

async function handleCallback(
  req: Request,
  env: Record<string, string | undefined>,
  appUrl: string,
  secure: boolean,
  fail: (msg: string) => Response,
): Promise<Response> {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("Google sign-in not configured");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = readCookie(req, OAUTH_STATE_COOKIE);
  if (url.searchParams.get("error")) return fail("Google sign-in was cancelled");
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("Invalid sign-in state, please try again");
  }

  // ── Exchange the authorization code for tokens ──
  const redirectUri = `${appUrl}/api/auth/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail("Could not verify Google sign-in");
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return fail("Could not verify Google sign-in");

  // ── Read the verified profile ──
  const infoRes = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  );
  if (!infoRes.ok) return fail("Could not read Google profile");
  const info = (await infoRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
  };
  const sub = info.sub;
  const email = normalizeEmail(info.email);
  if (!sub || !email) return fail("Google did not return an email");

  const db = getDB();
  const now = Date.now();

  // ── Find or create the account ──
  let user = await db
    .prepare("SELECT * FROM users WHERE google_sub = ?1 LIMIT 1")
    .bind(sub)
    .first<UserRow>();

  if (!user) {
    // No google_sub yet - link to an existing email account if one exists.
    const byEmail = await db
      .prepare("SELECT * FROM users WHERE email = ?1 LIMIT 1")
      .bind(email)
      .first<UserRow>();
    if (byEmail) {
      await db
        .prepare("UPDATE users SET google_sub = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(sub, now, byEmail.id)
        .run();
      user = byEmail;
    } else {
      const id = crypto.randomUUID();
      const ownerToken = await pickOwnerToken(
        db,
        readCookie(req, OAUTH_ADOPT_COOKIE),
      );
      await db
        .prepare(
          `INSERT INTO users (id, email, password_hash, google_sub, owner_token, created_at, updated_at)
           VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?5)`,
        )
        .bind(id, email, sub, ownerToken, now)
        .run();
      user = {
        id,
        email,
        password_hash: null,
        google_sub: sub,
        owner_token: ownerToken,
        created_at: now,
        updated_at: now,
      };
    }
  }

  const { token } = await createSession(db, user.id);
  const headers = new Headers({ Location: `${appUrl}/mock?signed_in=1` });
  headers.append("set-cookie", sessionCookie(token, secure));
  headers.append("set-cookie", clearCookie(OAUTH_STATE_COOKIE, secure));
  headers.append("set-cookie", clearCookie(OAUTH_ADOPT_COOKIE, secure));
  return new Response(null, { status: 302, headers });
}

function redirect(location: string, secure: boolean): Response {
  const headers = new Headers({ Location: location });
  // Clear any half-finished OAuth cookies on the error path too.
  headers.append("set-cookie", clearCookie(OAUTH_STATE_COOKIE, secure));
  headers.append("set-cookie", clearCookie(OAUTH_ADOPT_COOKIE, secure));
  return new Response(null, { status: 302, headers });
}
