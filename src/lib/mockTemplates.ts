/**
 * Template variables for dynamic mock responses, resolved fresh on every
 * request to /m/<slug>. Single-pass string replacement — no nesting, no
 * loops, no scripting. Malformed or unknown tokens are left as-is.
 */

export interface TemplateRequestContext {
  method: string;
  ip: string;
  headers: Headers;
  query: URLSearchParams;
}

// One pass over {{token}} / {{token:arg}} / {{token:a:b}} occurrences.
const TOKEN_RE = /\{\{([a-z_]+)((?::[^{}:]*)*)\}\}/g;

export function resolveTemplates(
  body: string,
  ctx: TemplateRequestContext,
): string {
  if (!body.includes("{{")) return body;
  return body.replace(TOKEN_RE, (match, name: string, rawArgs: string) => {
    const args = rawArgs ? rawArgs.slice(1).split(":") : [];
    const resolved = resolveToken(name, args, ctx);
    return resolved ?? match; // unknown/malformed -> leave untouched
  });
}

function resolveToken(
  name: string,
  args: string[],
  ctx: TemplateRequestContext,
): string | null {
  switch (name) {
    case "uuid":
      return crypto.randomUUID();
    case "timestamp":
      return new Date().toISOString();
    case "timestamp_unix":
      return String(Math.floor(Date.now() / 1000));
    case "random_int": {
      if (args.length === 0) return String(randInt(0, 9999));
      if (args.length !== 2) return null;
      const lo = parseInt(args[0], 10);
      const hi = parseInt(args[1], 10);
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) return null;
      return String(randInt(lo, hi));
    }
    case "random_float":
      return (Math.random()).toFixed(2);
    case "random_bool":
      return Math.random() < 0.5 ? "true" : "false";
    case "random_name":
      return NAMES[randInt(0, NAMES.length - 1)];
    case "random_email": {
      const fullName = NAMES[randInt(0, NAMES.length - 1)];
      return `${fullName.toLowerCase().replace(/ /g, ".")}@example.com`;
    }
    case "random_url":
      return `https://example.com/${URL_WORDS[randInt(0, URL_WORDS.length - 1)]}/${randInt(1, 999)}`;
    case "lorem": {
      const n = parseInt(args[0] ?? "", 10);
      if (!Number.isFinite(n) || n < 1 || n > 500) return null;
      const words: string[] = [];
      for (let i = 0; i < n; i++) words.push(LOREM[i % LOREM.length]);
      return words.join(" ");
    }
    case "request_method":
      return ctx.method;
    case "request_ip":
      return ctx.ip;
    case "request_header":
      return args.length === 1 ? (ctx.headers.get(args[0].toLowerCase()) ?? "") : null;
    case "request_query":
      return args.length === 1 ? (ctx.query.get(args[0]) ?? "") : null;
    default:
      return null;
  }
}

function randInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// Small hardcoded pool — no faker dependency needed.
const NAMES = [
  "Alice Johnson", "Bob Martinez", "Carol Chen", "David Okafor", "Emma Wilson",
  "Felix Novak", "Grace Kim", "Hassan Ali", "Ines Costa", "Jack Murphy",
  "Kira Sato", "Liam O'Brien", "Maya Patel", "Noah Schmidt", "Olga Petrova",
  "Pablo Garcia", "Quinn Taylor", "Rosa Silva", "Sam Wright", "Tara Singh",
  "Umar Khan", "Vera Lind", "Will Turner", "Xenia Pappas", "Yusuf Demir",
  "Zoe Clark", "Andre Dubois", "Bea Romano", "Carl Jensen", "Dina Haddad",
  "Eli Cohen", "Fay Wong", "Gus Anders", "Hana Suzuki", "Ivan Markov",
  "Jade Nguyen", "Karl Weber", "Lena Fischer", "Marco Ricci", "Nina Berg",
  "Omar Farouk", "Pia Larsen", "Ray Donovan", "Sofia Mendez", "Tom Becker",
  "Uma Reddy", "Vik Sharma", "Wanda Kowalski", "Yara Aziz", "Zane Foster",
];

const URL_WORDS = [
  "products", "users", "articles", "reports", "items", "orders", "assets",
  "posts", "docs", "files",
];

const LOREM = (
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod " +
  "tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam " +
  "quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo"
).split(" ");
