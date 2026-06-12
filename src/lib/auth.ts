/**
 * ★ AUTH - email+password and Google, on the Workers runtime (Web Crypto only,
 * no node:crypto). Sits ON TOP of the owner_token model: a `users` row owns one
 * canonical owner_token, and login hands that token back so the existing
 * x-owner-token API surface keeps working unchanged (see migrations/0009).
 */
import { generateToken, isValidToken } from "@/lib/token";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  google_sub: string | null;
  owner_token: string;
  created_at: number;
  updated_at: number;
}

// Public shape returned to the client (never leak the password hash).
export interface PublicUser {
  id: string;
  email: string;
  owner_token: string;
  has_password: boolean;
  has_google: boolean;
}

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    email: u.email,
    owner_token: u.owner_token,
    has_password: u.password_hash != null,
    has_google: u.google_sub != null,
  };
}

// ── Session config ──────────────────────────────────────────────────
export const SESSION_COOKIE = "stubby_session";
export const OAUTH_STATE_COOKIE = "stubby_oauth_state";
export const OAUTH_ADOPT_COOKIE = "stubby_oauth_adopt";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PBKDF2_ITERATIONS = 100_000; // SHA-256; infrequent op, comfortable CPU.

// ── Password hashing (PBKDF2-SHA256) ────────────────────────────────
// Stored as `pbkdf2$<iters>$<saltB64url>$<hashB64url>`.
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iters = Number(parts[1]);
  const salt = unb64url(parts[2]);
  const expected = unb64url(parts[3]);
  if (!Number.isInteger(iters) || iters < 1) return false;
  const actual = await pbkdf2(password, salt, iters);
  return timingSafeEqual(actual, expected);
}

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ── Sessions ────────────────────────────────────────────────────────
// We hand the client an opaque random token, and persist only its SHA-256.
export async function createSession(
  db: D1Database,
  userId: string,
): Promise<{ token: string; expiresAt: number }> {
  const token = generateOpaqueToken();
  const id = await sha256Hex(token);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await db
    .prepare(
      "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)",
    )
    .bind(id, userId, now, expiresAt)
    .run();
  return { token, expiresAt };
}

export async function destroySession(
  db: D1Database,
  token: string,
): Promise<void> {
  const id = await sha256Hex(token);
  await db.prepare("DELETE FROM sessions WHERE id = ?1").bind(id).run();
}

/** Resolve the logged-in user from the session cookie, or null. */
export async function getUserFromRequest(
  db: D1Database,
  req: Request,
): Promise<UserRow | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const id = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?1 AND s.expires_at > ?2 LIMIT 1`,
    )
    .bind(id, Date.now())
    .first<UserRow>();
  return row ?? null;
}

// ── Cookies ─────────────────────────────────────────────────────────
export function sessionCookie(token: string, secure: boolean): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return cookie(SESSION_COOKIE, token, { maxAge, secure, sameSite: "Lax" });
}

export function clearCookie(name: string, secure: boolean): string {
  return cookie(name, "", { maxAge: 0, secure, sameSite: "Lax" });
}

export function shortCookie(
  name: string,
  value: string,
  secure: boolean,
): string {
  // 10-minute cookie for the OAuth round-trip (state + token-to-adopt).
  return cookie(name, value, { maxAge: 600, secure, sameSite: "Lax" });
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

function cookie(
  name: string,
  value: string,
  opts: { maxAge: number; secure: boolean; sameSite: "Lax" | "Strict" },
): string {
  const segs = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${opts.sameSite}`,
    `Max-Age=${opts.maxAge}`,
  ];
  if (opts.secure) segs.push("Secure");
  return segs.join("; ");
}

/** Cookies need Secure in prod (https) but not on http://localhost dev. */
export function isSecureRequest(req: Request): boolean {
  return new URL(req.url).protocol === "https:";
}

// ── Token-to-adopt: keep pre-signup work ────────────────────────────
// On register / first Google sign-in we adopt the device's current anonymous
// owner_token as the account's canonical token, unless it's missing or already
// claimed by another account.
export async function pickOwnerToken(
  db: D1Database,
  candidate: string | null,
): Promise<string> {
  if (candidate && isValidToken(candidate)) {
    const taken = await db
      .prepare("SELECT 1 FROM users WHERE owner_token = ?1 LIMIT 1")
      .bind(candidate)
      .first();
    if (!taken) return candidate;
  }
  return generateToken();
}

// ── Validation ──────────────────────────────────────────────────────
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  // Pragmatic check - real validity is proven by delivery, not regex.
  if (email.length < 3 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function isValidPassword(raw: unknown): raw is string {
  return typeof raw === "string" && raw.length >= 8 && raw.length <= 200;
}

// ── Low-level helpers ───────────────────────────────────────────────
function generateOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return b64url(bytes);
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
