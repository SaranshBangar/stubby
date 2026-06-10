/**
 * ★ THE OWNER_TOKEN MODEL — anonymous identity, zero signup.
 *
 * A Stubby user's identity is a single long random token of the form
 * `tok_<32 url-safe chars>`, generated client-side on first visit and kept
 * in localStorage (see useOwnerToken on the client). It is sent with every
 * API request (header `x-owner-token` or query/body) and scopes all of that
 * browser's mocks and monitors.
 *
 * There are NO passwords and NO email required for the free tier. The token
 * IS the credential — whoever holds it owns the resources. Pro simply links
 * this same token to a Stripe subscription (see lib/tier.ts + accounts table).
 *
 * Security note: tokens are bearer secrets. We treat them as unguessable
 * (128 bits of entropy) and only ever match them exactly in WHERE clauses.
 */

const TOKEN_PREFIX = "tok_";
const TOKEN_BYTES = 24; // 24 bytes -> 32 base64url chars; ~192 bits entropy.

// Web Crypto only (edge-compatible — no node:crypto).
export function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return TOKEN_PREFIX + base64url(bytes);
}

export function isValidToken(token: unknown): token is string {
  return (
    typeof token === "string" &&
    token.startsWith(TOKEN_PREFIX) &&
    token.length > TOKEN_PREFIX.length + 16 &&
    token.length < 128 &&
    /^[A-Za-z0-9_-]+$/.test(token.slice(TOKEN_PREFIX.length))
  );
}

/**
 * Extract + validate the owner token from a request. Checks the
 * `x-owner-token` header first, then a `token` query param (handy for
 * simple GETs). Returns null if missing/invalid — callers should 401.
 */
export function getTokenFromRequest(req: Request): string | null {
  const header = req.headers.get("x-owner-token");
  if (isValidToken(header)) return header;
  const url = new URL(req.url);
  const q = url.searchParams.get("token");
  if (isValidToken(q)) return q;
  return null;
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
