import { getDB, getEnv } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, created, badRequest, unauthorized, forbidden } from "@/lib/http";
import { getLimitsForToken, computeExpiresAt } from "@/lib/tier";
import { generateSlug } from "@/lib/slug";
import type { WebhookEndpointRow } from "@/lib/types";

// GET /api/webhooks - list this token's capture endpoints (newest first),
// with a request count per endpoint for the list UI.
export async function GET(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const db = getDB();
  const { results } = await db
    .prepare(
      `SELECT e.*,
              (SELECT COUNT(*) FROM webhook_requests r WHERE r.endpoint_id = e.id) AS request_count
         FROM webhook_endpoints e
        WHERE e.owner_token = ?1
        ORDER BY e.created_at DESC`,
    )
    .bind(token)
    .all<WebhookEndpointRow & { request_count: number }>();
  return ok({ endpoints: results ?? [] });
}

// POST /api/webhooks - create an endpoint. Enforces the tier's endpoint cap.
export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const label = String(body.label ?? "").trim().slice(0, 80);

  const db = getDB();
  const env = getEnv();
  const { limits } = await getLimitsForToken(db, token, env);

  const countRow = await db
    .prepare("SELECT COUNT(*) AS n FROM webhook_endpoints WHERE owner_token = ?1")
    .bind(token)
    .first<{ n: number }>();
  if ((countRow?.n ?? 0) >= limits.maxWebhookEndpoints) {
    return forbidden(
      `Webhook endpoint limit reached (${limits.maxWebhookEndpoints}). Upgrade to Pro for more.`,
    );
  }

  const now = Date.now();
  const expiresAt = computeExpiresAt(limits, now);

  // The endpoint id doubles as the public slug - retry on the rare clash.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    try {
      await db
        .prepare(
          `INSERT INTO webhook_endpoints (id, owner_token, label, created_at, expires_at)
           VALUES (?1, ?2, ?3, ?4, ?5)`,
        )
        .bind(slug, token, label, now, expiresAt)
        .run();
      const row = await db
        .prepare("SELECT * FROM webhook_endpoints WHERE id = ?1")
        .bind(slug)
        .first<WebhookEndpointRow>();
      return created({ endpoint: row });
    } catch (err) {
      if (String(err).includes("UNIQUE")) continue;
      throw err;
    }
  }
  return badRequest("Could not allocate a unique slug, try again");
}
