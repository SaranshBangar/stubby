import { getDB } from "@/lib/db";
import { WEBHOOK_BODY_MAX_BYTES, getLimits } from "@/config/limits";
import type { WebhookEndpointRow } from "@/lib/types";

/**
 * ★ The webhook receiver. Any method, any sub-path under /w/<slug> lands
 * here; we store the full request and always answer 200 {"ok":true} so the
 * sender treats the delivery as accepted. Shared by both receiver routes
 * (/w/[slug] and /w/[slug]/[...path]).
 */
export async function captureWebhookRequest(
  req: Request,
  slug: string,
  subPath: string[],
): Promise<Response> {
  const db = getDB();
  const now = Date.now();

  const endpoint = await db
    .prepare("SELECT * FROM webhook_endpoints WHERE id = ?1")
    .bind(slug)
    .first<WebhookEndpointRow>();

  if (!endpoint) {
    return jsonRes({ error: "No webhook endpoint with that slug." }, 404);
  }
  // Expired free endpoints answer 410 Gone (mirrors expired mocks).
  if (endpoint.expires_at != null && endpoint.expires_at <= now) {
    return jsonRes({ error: "This webhook endpoint has expired." }, 410);
  }

  // ── Snapshot the request. Each piece guarded so a weird payload can't
  // make the receiver fail — capture what we can, always ACK. ──
  const url = new URL(req.url);
  const path = subPath.length > 0 ? `/${subPath.join("/")}` : "/";

  const query: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) query[k] = v;

  const headers: Record<string, string> = {};
  for (const [k, v] of req.headers.entries()) headers[k] = v;

  let bodyRaw = "";
  let bodySize = 0;
  try {
    const text = await req.text();
    bodySize = new TextEncoder().encode(text).byteLength;
    bodyRaw =
      bodySize > WEBHOOK_BODY_MAX_BYTES
        ? text.slice(0, WEBHOOK_BODY_MAX_BYTES)
        : text;
  } catch {
    // Unreadable body (aborted stream etc.) — store empty, still ACK.
  }

  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  try {
    await db
      .prepare(
        `INSERT INTO webhook_requests
          (id, endpoint_id, received_at, method, path, query_json, headers_json, body_raw, body_size, content_type, ip_address)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      )
      .bind(
        crypto.randomUUID(),
        endpoint.id,
        now,
        req.method,
        path,
        JSON.stringify(query),
        JSON.stringify(headers),
        bodyRaw,
        bodySize,
        req.headers.get("content-type"),
        ip,
      )
      .run();

    // Safety cap at capture time: bound a burst to the Pro (max) per-endpoint
    // limit so storage can't run away between cron ticks. The cron enforces
    // the exact per-tier limit every minute.
    const cap = getLimits("pro").webhookRequestsPerEndpoint;
    await db
      .prepare(
        `DELETE FROM webhook_requests
          WHERE endpoint_id = ?1
            AND id NOT IN (
              SELECT id FROM webhook_requests WHERE endpoint_id = ?1
              ORDER BY received_at DESC LIMIT ?2
            )`,
      )
      .bind(endpoint.id, cap)
      .run();
  } catch {
    // A write hiccup must not bounce the sender — still ACK.
  }

  return jsonRes({ ok: true }, 200);
}

// Decorate an OPTIONS response with permissive preflight headers so browser
// senders can follow up with the real (captured) request.
export function withCorsPreflight(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set(
    "access-control-allow-methods",
    "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS",
  );
  headers.set("access-control-allow-headers", "*");
  return new Response(res.body, { status: res.status, headers });
}

function jsonRes(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}
