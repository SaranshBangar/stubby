import type { MockRuleRow } from "@/lib/types";

/**
 * Conditional mock rule evaluation. Rules are checked in sort_order against
 * the incoming request; the first match wins. Evaluation never throws — a
 * weird request shape just means "no match".
 */

export interface RuleRequestContext {
  method: string;
  headers: Headers;
  query: URLSearchParams;
  /** Parsed JSON request body, or null if absent/unparseable. */
  body: unknown;
}

export function findMatchingRule(
  rules: MockRuleRow[],
  ctx: RuleRequestContext,
): MockRuleRow | null {
  for (const rule of rules) {
    try {
      if (matches(rule, ctx)) return rule;
    } catch {
      // A broken rule must not take the mock down — skip it.
    }
  }
  return null;
}

/** Does any rule need the request body parsed? (Avoids reading it otherwise.) */
export function rulesNeedBody(rules: MockRuleRow[]): boolean {
  return rules.some((r) => r.condition_type === "body_field");
}

function matches(rule: MockRuleRow, ctx: RuleRequestContext): boolean {
  const value = extractValue(rule, ctx);
  switch (rule.condition_op) {
    case "exists":
      return value != null;
    case "not_exists":
      return value == null;
    case "equals":
      return value != null && value === (rule.condition_value ?? "");
    case "contains":
      return value != null && value.includes(rule.condition_value ?? "");
    default:
      return false;
  }
}

// The string the condition compares against, or null when absent.
function extractValue(
  rule: MockRuleRow,
  ctx: RuleRequestContext,
): string | null {
  switch (rule.condition_type) {
    case "query_param":
      return ctx.query.get(rule.condition_key);
    case "header":
      return ctx.headers.get(rule.condition_key.toLowerCase());
    case "method":
      return ctx.method;
    case "body_field": {
      const v = traverse(ctx.body, rule.condition_key);
      if (v === undefined || v === null) return null;
      return typeof v === "string" ? v : JSON.stringify(v);
    }
    default:
      return null;
  }
}

// Dot-notation path into a parsed JSON body, e.g. "user.role".
function traverse(value: unknown, path: string): unknown {
  let cur: unknown = value;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}
