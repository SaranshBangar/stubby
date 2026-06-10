// Mock slug generator. Short, url-safe, lowercase. Used in /m/<slug>.
// Avoids ambiguous chars (0/o/1/l). Caller retries on the rare UNIQUE clash.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const SLUG_LEN = 8;

export function generateSlug(): string {
  const bytes = new Uint8Array(SLUG_LEN);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

// User-supplied custom slugs must be clean (no path tricks, reasonable len).
export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === "string" && /^[a-z0-9][a-z0-9-]{1,40}$/.test(slug);
}
