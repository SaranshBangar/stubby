import { getDB } from "@/lib/db";
import type { MockRow } from "@/lib/types";

// ★ The public mock responder. Devs hit this URL; it replays the stored
// status / headers / body after the optional delay. Responds to ALL methods
// (devs mock POST/PUT/DELETE too) — one handler, exported under each verb.

async function respond(slug: string): Promise<Response> {
  const db = getDB();
  const now = Date.now();

  const mock = await db
    .prepare("SELECT * FROM mocks WHERE slug = ?1")
    .bind(slug)
    .first<MockRow>();

  if (!mock) {
    return json404("No mock with that slug (it may have expired).");
  }

  // Expired free mocks return 410 Gone rather than serving stale data.
  if (mock.expires_at != null && mock.expires_at <= now) {
    return new Response(
      JSON.stringify({ error: "This mock has expired." }),
      { status: 410, headers: { "content-type": "application/json" } },
    );
  }

  // Artificial delay (capped at insert time to <=30s). Cooperative wait.
  if (mock.delay_ms > 0) {
    await new Promise((r) => setTimeout(r, mock.delay_ms));
  }

  // Custom headers. Default content-type to JSON unless the mock overrode it.
  const headers = new Headers();
  let custom: Record<string, string> = {};
  try {
    custom = JSON.parse(mock.headers_json) as Record<string, string>;
  } catch {
    custom = {};
  }
  for (const [k, v] of Object.entries(custom)) headers.set(k, String(v));
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  // Make it obvious where the response came from + allow browser testing.
  headers.set("x-powered-by", "stubby");
  headers.set("access-control-allow-origin", "*");

  return new Response(mock.body_json, {
    status: mock.status_code,
    headers,
  });
}

function json404(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}

type Ctx = { params: Promise<{ slug: string }> };
const handler = async (_req: Request, { params }: Ctx) =>
  respond((await params).slug);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;

// CORS preflight so browser fetches against a mock work out of the box.
export const OPTIONS = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "*",
    },
  });
