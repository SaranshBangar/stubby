import { getDB, getEnv } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { ok } from "@/lib/http";
import { sendProWelcomeEmail } from "@/lib/proWelcome";
import type { EmailEnv } from "@/lib/email";

const ADMIN_EMAIL = "saranshbangad@gmail.com";

function forbidden() {
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}

/** GET /api/admin/users — list all users with stats (admin only). */
export async function GET(req: Request) {
  const db = getDB();
  const user = await getUserFromRequest(db, req);
  if (!user || user.email !== ADMIN_EMAIL) return forbidden();

  const users = await db
    .prepare(
      `SELECT u.id, u.email, u.owner_token, u.created_at,
              a.status     AS pro_status,
              a.cf_order_id,
              (SELECT COUNT(*) FROM mocks   WHERE owner_token = u.owner_token) AS mock_count,
              (SELECT COUNT(*) FROM monitors WHERE owner_token = u.owner_token) AS monitor_count
       FROM users u
       LEFT JOIN accounts a ON a.owner_token = u.owner_token
       ORDER BY u.created_at DESC`,
    )
    .all();

  return ok({ users: users.results });
}

/** POST /api/admin/users — grant or revoke Pro for a user (admin only). */
export async function POST(req: Request) {
  const db = getDB();
  const admin = await getUserFromRequest(db, req);
  if (!admin || admin.email !== ADMIN_EMAIL) return forbidden();

  const body = (await req.json()) as { owner_token: string; action: "grant" | "revoke" };
  const { owner_token, action } = body;
  if (!owner_token || (action !== "grant" && action !== "revoke")) {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
  }

  const status = action === "grant" ? "active" : "canceled";
  const now = Date.now();

  // Was this token already Pro? Avoids re-sending the welcome email on a
  // repeat grant.
  const prior = await db
    .prepare("SELECT status FROM accounts WHERE owner_token = ?1 LIMIT 1")
    .bind(owner_token)
    .first<{ status: string }>();
  const wasActive = prior?.status === "active";

  await db
    .prepare(
      `INSERT INTO accounts (id, owner_token, cf_customer, cf_order_id, status, created_at, updated_at)
       VALUES (?1, ?2, NULL, 'admin_grant', ?3, ?4, ?4)
       ON CONFLICT(owner_token) DO UPDATE SET
         status     = excluded.status,
         cf_order_id = excluded.cf_order_id,
         updated_at = excluded.updated_at`,
    )
    .bind(crypto.randomUUID(), owner_token, status, now)
    .run();

  // First-time grant -> send the welcome email (best-effort).
  if (action === "grant" && !wasActive) {
    const env = getEnv() as EmailEnv;
    await sendProWelcomeEmail(env, db, owner_token).catch(() => {});
  }

  return ok({ ok: true });
}
