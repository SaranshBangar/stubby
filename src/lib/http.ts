// Tiny JSON response helpers for API routes. Keeps handlers terse.

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

export const ok = (data: unknown) => json(data, { status: 200 });
export const created = (data: unknown) => json(data, { status: 201 });
export const badRequest = (msg: string) => json({ error: msg }, { status: 400 });
export const unauthorized = (msg = "Missing or invalid owner token") =>
  json({ error: msg }, { status: 401 });
export const notFound = (msg = "Not found") => json({ error: msg }, { status: 404 });
export const forbidden = (msg: string) => json({ error: msg }, { status: 403 });
