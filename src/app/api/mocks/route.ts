import { getDB, getEnv } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, created, badRequest, unauthorized, forbidden } from "@/lib/http";
import { getLimitsForToken, computeExpiresAt } from "@/lib/tier";
import { generateSlug, isValidSlug } from "@/lib/slug";
import type { MockRow } from "@/lib/types";

// No Node APIs; keep work minimal (CPU budget). Runs on the Workers runtime.

// GET /api/mocks - list this token's mocks (newest first).
export async function GET(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const db = getDB();
  const { results } = await db
    .prepare(
      "SELECT * FROM mocks WHERE owner_token = ?1 ORDER BY created_at DESC",
    )
    .bind(token)
    .all<MockRow>();
  return ok({ mocks: results ?? [] });
}

// POST /api/mocks - create a mock. Enforces the tier's max-mocks limit.
export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  // ── Validate inputs ──
  const statusCode = Number(body.status_code ?? 200);
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    return badRequest("status_code must be 100–599");
  }

  const delayMs = Number(body.delay_ms ?? 0);
  if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 30_000) {
    return badRequest("delay_ms must be 0–30000");
  }

  // headers: must be a flat string->string object.
  const headers = body.headers ?? {};
  if (typeof headers !== "object" || headers === null || Array.isArray(headers)) {
    return badRequest("headers must be an object");
  }
  for (const v of Object.values(headers as Record<string, unknown>)) {
    if (typeof v !== "string") return badRequest("header values must be strings");
  }

  // body_json: accept a string (stored verbatim) or any JSON value.
  const rawBody = body.body ?? {};
  const bodyJson = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);

  // Optional custom slug (Pro nicety) - validate; else auto-generate.
  let slug = body.slug;
  if (slug != null) {
    if (!isValidSlug(slug)) return badRequest("Invalid slug");
  } else {
    slug = null;
  }

  const db = getDB();
  const env = getEnv();

  // ── Enforce limit ──
  const { limits } = await getLimitsForToken(db, token, env);
  const countRow = await db
    .prepare("SELECT COUNT(*) AS n FROM mocks WHERE owner_token = ?1")
    .bind(token)
    .first<{ n: number }>();
  if ((countRow?.n ?? 0) >= limits.maxMocks) {
    return forbidden(
      `Mock limit reached (${limits.maxMocks}). Upgrade to Pro for more.`,
    );
  }

  const now = Date.now();
  const expiresAt = computeExpiresAt(limits, now);
  const id = crypto.randomUUID();

  // Insert with slug-collision retry (UNIQUE). Custom slugs don't retry -
  // a clash there is a real conflict the user should see.
  const headersJson = JSON.stringify(headers);
  for (let attempt = 0; attempt < 5; attempt++) {
    const useSlug = (slug as string | null) ?? generateSlug();
    try {
      await db
        .prepare(
          `INSERT INTO mocks (id, owner_token, slug, status_code, headers_json, body_json, delay_ms, created_at, expires_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
        )
        .bind(id, token, useSlug, statusCode, headersJson, bodyJson, delayMs, now, expiresAt)
        .run();
      const row = await db
        .prepare("SELECT * FROM mocks WHERE id = ?1")
        .bind(id)
        .first<MockRow>();
      return created({ mock: row });
    } catch (err) {
      const msg = String(err);
      if (msg.includes("UNIQUE") && slug == null) continue; // retry auto slug
      if (msg.includes("UNIQUE")) return badRequest("Slug already taken");
      throw err;
    }
  }
  return badRequest("Could not allocate a unique slug, try again");
}
