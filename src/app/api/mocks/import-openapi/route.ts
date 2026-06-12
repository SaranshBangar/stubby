import { getDB, getEnv } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, badRequest, unauthorized } from "@/lib/http";
import { getLimitsForToken, computeExpiresAt } from "@/lib/tier";
import { parseOpenApiSpec, extractMockCandidates } from "@/lib/openapiImport";
import type { MockRow } from "@/lib/types";

/**
 * POST /api/mocks/import-openapi - bulk-create mocks from an OpenAPI 3.x /
 * Swagger 2.x spec. Accepts a multipart upload (field "file") or a JSON
 * body { "spec": "raw JSON or YAML" }. Imports up to the tier's mock
 * limit; everything beyond is counted as skipped with a reason.
 */
export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();

  // ── Get the raw spec text from either input shape. ──
  let raw: string | null = null;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      const file = form.get("file");
      if (file instanceof Blob) raw = await file.text();
      else if (typeof file === "string") raw = file;
    } catch {
      return badRequest("Could not read the uploaded file");
    }
  } else {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      if (typeof body.spec === "string") raw = body.spec;
    } catch {
      return badRequest("Body must be JSON with a `spec` string, or a multipart upload");
    }
  }
  if (!raw || !raw.trim()) {
    return badRequest("No spec provided (upload a file or pass { spec })");
  }

  // ── Parse + dereference. Bad specs are a 400, not a 500. ──
  let candidates;
  try {
    const doc = await parseOpenApiSpec(raw);
    candidates = extractMockCandidates(doc);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return badRequest(`Invalid OpenAPI/Swagger spec: ${msg.slice(0, 300)}`);
  }
  if (candidates.length === 0) {
    return badRequest("Spec contains no path + method operations to import");
  }

  const db = getDB();
  const env = getEnv();
  const { limits } = await getLimitsForToken(db, token, env);
  const countRow = await db
    .prepare("SELECT COUNT(*) AS n FROM mocks WHERE owner_token = ?1")
    .bind(token)
    .first<{ n: number }>();
  const capacity = Math.max(0, limits.maxMocks - (countRow?.n ?? 0));

  const now = Date.now();
  const expiresAt = computeExpiresAt(limits, now);
  const mocks: MockRow[] = [];
  let skipped = 0;

  for (const c of candidates) {
    if (mocks.length >= capacity) {
      skipped++;
      continue;
    }
    const id = crypto.randomUUID();
    try {
      await db
        .prepare(
          `INSERT INTO mocks (id, owner_token, slug, status_code, headers_json, body_json, delay_ms, created_at, expires_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8)`,
        )
        .bind(
          id,
          token,
          c.slug,
          c.status_code,
          JSON.stringify({ "content-type": c.content_type }),
          c.body,
          now,
          expiresAt,
        )
        .run();
      const row = await db
        .prepare("SELECT * FROM mocks WHERE id = ?1")
        .bind(id)
        .first<MockRow>();
      if (row) mocks.push(row);
    } catch (err) {
      // Slug already taken (or any insert failure) => count as skipped.
      if (String(err).includes("UNIQUE")) skipped++;
      else throw err;
    }
  }

  return ok({
    created: mocks.length,
    skipped,
    mocks,
    ...(skipped > 0 && mocks.length >= capacity
      ? {
          reason: `Mock limit reached (${limits.maxMocks}); upgrade to Pro to import more.`,
        }
      : {}),
  });
}
