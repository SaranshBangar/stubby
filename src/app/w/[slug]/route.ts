import {
  captureWebhookRequest,
  withCorsPreflight,
} from "@/lib/webhookCapture";

// ★ Webhook receiver — root path (/w/<slug>). Every method is captured and
// ACKed with 200 {"ok":true}. Sub-paths land in /w/[slug]/[...path].

type Ctx = { params: Promise<{ slug: string }> };

const handler = async (req: Request, { params }: Ctx) =>
  captureWebhookRequest(req, (await params).slug, []);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;

// Preflights are captured too, but must carry permissive CORS headers so the
// browser proceeds with the real request.
export const OPTIONS = async (req: Request, ctx: Ctx) => {
  const res = await captureWebhookRequest(req, (await ctx.params).slug, []);
  return withCorsPreflight(res);
};
