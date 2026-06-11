import { getDB } from "@/lib/db";
import { resolveTemplates } from "@/lib/mockTemplates";
import { findMatchingRule, rulesNeedBody } from "@/lib/mockRules";
import type { MockRow, MockRuleRow } from "@/lib/types";

// ★ The public mock responder. Devs hit this URL; it replays the stored
// status / headers / body after the optional delay. Responds to ALL methods
// (devs mock POST/PUT/DELETE too) — one handler, exported under each verb.
//
// Dynamic behavior (both resolved at serve time):
//   - conditional rules: first matching rule (by sort_order) overrides the
//     default status/body/headers; no match falls back to the default,
//   - template variables ({{uuid}}, {{request_query:x}}, …) in the body.

async function respond(req: Request, slug: string): Promise<Response> {
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

  // ── Conditional rules: first match wins, else the default response. ──
  let status = mock.status_code;
  let body = mock.body_json;
  let headersJson = mock.headers_json;
  try {
    const { results } = await db
      .prepare("SELECT * FROM mock_rules WHERE mock_id = ?1 ORDER BY sort_order")
      .bind(mock.id)
      .all<MockRuleRow>();
    const rules = results ?? [];
    if (rules.length > 0) {
      const url = new URL(req.url);
      let parsedBody: unknown = null;
      if (rulesNeedBody(rules)) {
        try {
          parsedBody = JSON.parse(await req.text());
        } catch {
          parsedBody = null; // non-JSON body => body_field conditions miss
        }
      }
      const rule = findMatchingRule(rules, {
        method: req.method,
        headers: req.headers,
        query: url.searchParams,
        body: parsedBody,
      });
      if (rule) {
        status = rule.response_status;
        body = rule.response_body;
        headersJson = rule.response_headers;
      }
    }
  } catch {
    // Rule lookup/evaluation problems fall back to the default response.
  }

  // Artificial delay (capped at insert time to <=30s). Cooperative wait.
  if (mock.delay_ms > 0) {
    await new Promise((r) => setTimeout(r, mock.delay_ms));
  }

  // ── Template variables, resolved fresh per request. ──
  try {
    const url = new URL(req.url);
    body = resolveTemplates(body, {
      method: req.method,
      ip:
        req.headers.get("cf-connecting-ip") ??
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "",
      headers: req.headers,
      query: url.searchParams,
    });
  } catch {
    // Template trouble => serve the body verbatim.
  }

  // Custom headers. Default content-type to JSON unless the mock overrode it.
  const headers = new Headers();
  let custom: Record<string, string> = {};
  try {
    custom = JSON.parse(headersJson) as Record<string, string>;
  } catch {
    custom = {};
  }
  for (const [k, v] of Object.entries(custom)) headers.set(k, String(v));
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  // Make it obvious where the response came from + allow browser testing.
  headers.set("x-powered-by", "stubby");
  headers.set("access-control-allow-origin", "*");

  return new Response(body, { status, headers });
}

function json404(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}

type Ctx = { params: Promise<{ slug: string }> };
const handler = async (req: Request, { params }: Ctx) =>
  respond(req, (await params).slug);

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
