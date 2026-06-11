import { getDB, getEnv } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, created, badRequest, unauthorized, notFound, forbidden } from "@/lib/http";
import { getLimitsForToken } from "@/lib/tier";
import type { MockRuleRow } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const CONDITION_TYPES = ["query_param", "header", "body_field", "method"] as const;
const CONDITION_OPS = ["equals", "contains", "exists", "not_exists"] as const;

async function ownedMock(db: D1Database, id: string, token: string) {
  return db
    .prepare("SELECT id FROM mocks WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .first<{ id: string }>();
}

// GET /api/mocks/:id/rules — the mock's rules in evaluation order.
export async function GET(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  const db = getDB();
  if (!(await ownedMock(db, id, token))) return notFound();

  const { results } = await db
    .prepare("SELECT * FROM mock_rules WHERE mock_id = ?1 ORDER BY sort_order")
    .bind(id)
    .all<MockRuleRow>();
  return ok({ rules: results ?? [] });
}

// POST /api/mocks/:id/rules — append a rule. Enforces the tier's per-mock cap.
export async function POST(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  const db = getDB();
  if (!(await ownedMock(db, id, token))) return notFound();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const conditionType = String(body.condition_type ?? "");
  if (!CONDITION_TYPES.includes(conditionType as (typeof CONDITION_TYPES)[number])) {
    return badRequest(`condition_type must be one of ${CONDITION_TYPES.join(", ")}`);
  }
  const conditionOp = String(body.condition_op ?? "");
  if (!CONDITION_OPS.includes(conditionOp as (typeof CONDITION_OPS)[number])) {
    return badRequest(`condition_op must be one of ${CONDITION_OPS.join(", ")}`);
  }
  const conditionKey = String(body.condition_key ?? "").trim().slice(0, 200);
  if (!conditionKey && conditionType !== "method") {
    return badRequest("condition_key is required for this condition type");
  }
  const needsValue = conditionOp === "equals" || conditionOp === "contains";
  const conditionValue =
    body.condition_value != null ? String(body.condition_value).slice(0, 500) : null;
  if (needsValue && !conditionValue) {
    return badRequest("condition_value is required for equals/contains");
  }

  const responseStatus = Number(body.response_status ?? 200);
  if (!Number.isInteger(responseStatus) || responseStatus < 100 || responseStatus > 599) {
    return badRequest("response_status must be 100–599");
  }

  const rawBody = body.response_body ?? "{}";
  const responseBody = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);

  const respHeaders = body.response_headers ?? {};
  if (typeof respHeaders !== "object" || respHeaders === null || Array.isArray(respHeaders)) {
    return badRequest("response_headers must be an object");
  }

  const { limits } = await getLimitsForToken(db, token, getEnv());
  const countRow = await db
    .prepare("SELECT COUNT(*) AS n FROM mock_rules WHERE mock_id = ?1")
    .bind(id)
    .first<{ n: number }>();
  if ((countRow?.n ?? 0) >= limits.maxRulesPerMock) {
    return forbidden(
      `Rule limit reached (${limits.maxRulesPerMock} per mock). Upgrade to Pro for more.`,
    );
  }

  const maxOrder = await db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM mock_rules WHERE mock_id = ?1")
    .bind(id)
    .first<{ m: number }>();

  const ruleId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO mock_rules
        (id, mock_id, sort_order, condition_type, condition_key, condition_op, condition_value,
         response_status, response_body, response_headers)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    )
    .bind(
      ruleId,
      id,
      (maxOrder?.m ?? -1) + 1,
      conditionType,
      conditionKey,
      conditionOp,
      needsValue ? conditionValue : null,
      responseStatus,
      responseBody,
      JSON.stringify(respHeaders),
    )
    .run();

  const row = await db
    .prepare("SELECT * FROM mock_rules WHERE id = ?1")
    .bind(ruleId)
    .first<MockRuleRow>();
  return created({ rule: row });
}
