import { getDB } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/token";
import { ok, unauthorized, notFound } from "@/lib/http";
import { dispatchToChannel } from "@/lib/alerts";
import type { AlertChannelRow } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/alert-channels/:id/test - send a dummy message to the channel
// so the user can confirm the webhook URL works. Logged like a real alert.
export async function POST(req: Request, { params }: Ctx) {
  const token = getTokenFromRequest(req);
  if (!token) return unauthorized();
  const { id } = await params;
  const db = getDB();

  const channel = await db
    .prepare("SELECT * FROM alert_channels WHERE id = ?1 AND owner_token = ?2")
    .bind(id, token)
    .first<AlertChannelRow>();
  if (!channel) return notFound();

  const success = await dispatchToChannel(db, channel, null, {
    event: "up",
    details: "This is a test alert from Stubby",
    emailSubject: "",
    emailHtml: "",
  });

  return ok({ success });
}
