import {
  captureWebhookRequest,
  withCorsPreflight,
} from "@/lib/webhookCapture";

// ★ Webhook receiver - sub-paths (/w/<slug>/users/42 captures path
// "/users/42"). Same capture-and-ACK behavior as the root receiver.

type Ctx = { params: Promise<{ slug: string; path: string[] }> };

const handler = async (req: Request, { params }: Ctx) => {
  const { slug, path } = await params;
  return captureWebhookRequest(req, slug, path);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;

export const OPTIONS = async (req: Request, ctx: Ctx) => {
  const { slug, path } = await ctx.params;
  return withCorsPreflight(await captureWebhookRequest(req, slug, path));
};
