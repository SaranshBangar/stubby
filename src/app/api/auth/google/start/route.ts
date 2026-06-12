import { getEnv } from "@/lib/db";
import { badRequest } from "@/lib/http";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_ADOPT_COOKIE,
  shortCookie,
  isSecureRequest,
} from "@/lib/auth";
import { getTokenFromRequest } from "@/lib/token";

/**
 * GET /api/auth/google/start - kick off Google OAuth (authorization code).
 *
 * Stashes a CSRF `state` and the device's current anonymous owner_token (to
 * adopt for brand-new accounts) in short-lived httpOnly cookies, then redirects
 * to Google's consent screen. Pass the anon token as `?token=tok_...`.
 */
export async function GET(req: Request) {
  const env = getEnv() as Record<string, string | undefined>;
  const clientId = env.GOOGLE_CLIENT_ID;
  const appUrl = env.APP_URL ?? new URL(req.url).origin;
  if (!clientId) return badRequest("Google sign-in not configured (GOOGLE_CLIENT_ID)");

  const state = crypto.randomUUID();
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "online");
  authUrl.searchParams.set("prompt", "select_account");

  const secure = isSecureRequest(req);
  const adopt = getTokenFromRequest(req) ?? "";

  const headers = new Headers({ Location: authUrl.toString() });
  headers.append("set-cookie", shortCookie(OAUTH_STATE_COOKIE, state, secure));
  headers.append("set-cookie", shortCookie(OAUTH_ADOPT_COOKIE, adopt, secure));
  return new Response(null, { status: 302, headers });
}
