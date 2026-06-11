import SwaggerParser from "@apidevtools/swagger-parser";
import yaml from "js-yaml";
import { generateSlug } from "@/lib/slug";

/**
 * OpenAPI 3.x / Swagger 2.x → mock endpoints. Parses a raw spec (JSON or
 * YAML), dereferences $refs with swagger-parser, and turns every
 * path+method into a mock candidate with the best example response we can
 * find (explicit example > first of `examples` > generated from schema).
 */

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
] as const;

const MAX_SCHEMA_DEPTH = 3;

// Minimal structural types for the parts of a (dereferenced) spec we read.
// Both OAS3 (content.<mime>) and Swagger 2 (schema/examples) shapes fit.
interface SpecSchema {
  type?: string;
  format?: string;
  enum?: unknown[];
  example?: unknown;
  default?: unknown;
  properties?: Record<string, SpecSchema>;
  items?: SpecSchema;
  allOf?: SpecSchema[];
  oneOf?: SpecSchema[];
  anyOf?: SpecSchema[];
}

interface SpecMediaType {
  example?: unknown;
  examples?: Record<string, { value?: unknown }>;
  schema?: SpecSchema;
}

interface SpecResponse {
  content?: Record<string, SpecMediaType>; // OAS3
  schema?: SpecSchema; // Swagger 2
  examples?: Record<string, unknown>; // Swagger 2
}

interface SpecOperation {
  responses?: Record<string, SpecResponse>;
}

interface SpecDocument {
  paths?: Record<string, Record<string, SpecOperation>>;
}

export interface MockCandidate {
  path: string;
  method: string;
  slug: string;
  status_code: number;
  content_type: string;
  body: string;
}

/** Parse raw JSON or YAML text and dereference all $refs. Throws on bad specs. */
export async function parseOpenApiSpec(raw: string): Promise<SpecDocument> {
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    doc = yaml.load(raw);
  }
  if (doc == null || typeof doc !== "object") {
    throw new Error("Spec is not a JSON or YAML document");
  }
  // swagger-parser validates the document shape and inlines $refs.
  const deref = await SwaggerParser.dereference(doc as never);
  return deref as SpecDocument;
}

/** Flatten every path+method into a mock candidate. */
export function extractMockCandidates(doc: SpecDocument): MockCandidate[] {
  const out: MockCandidate[] = [];
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    if (item == null || typeof item !== "object") continue;
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (op == null || typeof op !== "object") continue;
      const { status, response } = pickResponse(op);
      const { contentType, body } = pickExample(response);
      out.push({
        path,
        method: method.toUpperCase(),
        slug: deriveSlug(method, path),
        status_code: status,
        content_type: contentType,
        body,
      });
    }
  }
  return out;
}

// First 2xx response defined (lowest code), else 200 with an empty body.
function pickResponse(op: SpecOperation): { status: number; response: SpecResponse } {
  const responses = op.responses ?? {};
  const codes = Object.keys(responses)
    .filter((c) => /^2\d\d$/.test(c))
    .sort();
  if (codes.length === 0) return { status: 200, response: {} };
  return { status: parseInt(codes[0], 10), response: responses[codes[0]] ?? {} };
}

function pickExample(response: SpecResponse): { contentType: string; body: string } {
  // OAS3: responses.<code>.content.<mime>
  const content = response.content;
  if (content && Object.keys(content).length > 0) {
    const mime =
      Object.keys(content).find((k) => k.includes("json")) ?? Object.keys(content)[0];
    const media = content[mime] ?? {};
    const value = exampleFromMedia(media);
    return { contentType: mime, body: serialize(value) };
  }

  // Swagger 2: responses.<code>.schema (+ optional examples keyed by mime)
  if (response.examples && Object.keys(response.examples).length > 0) {
    const mime =
      Object.keys(response.examples).find((k) => k.includes("json")) ??
      Object.keys(response.examples)[0];
    return { contentType: mime, body: serialize(response.examples[mime]) };
  }
  if (response.schema) {
    return {
      contentType: "application/json",
      body: serialize(exampleFromSchema(response.schema, 0)),
    };
  }

  return { contentType: "application/json", body: "{}" };
}

function exampleFromMedia(media: SpecMediaType): unknown {
  if (media.example !== undefined) return media.example;
  if (media.examples) {
    const first = Object.values(media.examples)[0];
    if (first?.value !== undefined) return first.value;
  }
  if (media.schema) return exampleFromSchema(media.schema, 0);
  return {};
}

// Minimal valid example from a schema: strings -> "string", numbers -> 0,
// booleans -> false, arrays -> one item, objects -> recurse (max depth 3).
function exampleFromSchema(schema: SpecSchema, depth: number): unknown {
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];

  if (schema.allOf?.length) {
    const merged: Record<string, unknown> = {};
    for (const sub of schema.allOf) {
      const v = exampleFromSchema(sub, depth);
      if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(merged, v);
    }
    return merged;
  }
  const alt = schema.oneOf?.[0] ?? schema.anyOf?.[0];
  if (alt) return exampleFromSchema(alt, depth);

  const type = schema.type ?? (schema.properties ? "object" : undefined);
  switch (type) {
    case "string":
      return schema.format === "date-time"
        ? "2024-01-01T00:00:00Z"
        : schema.format === "email"
          ? "user@example.com"
          : "string";
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      if (depth >= MAX_SCHEMA_DEPTH || !schema.items) return [];
      return [exampleFromSchema(schema.items, depth + 1)];
    case "object": {
      if (depth >= MAX_SCHEMA_DEPTH) return {};
      const obj: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(schema.properties ?? {})) {
        obj[key] = exampleFromSchema(prop, depth + 1);
      }
      return obj;
    }
    default:
      return null;
  }
}

function serialize(value: unknown): string {
  if (value === undefined) return "{}";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

// "/users/{id}" + get -> "get-users-id-<4 random chars>".
function deriveSlug(method: string, path: string): string {
  const pathPart = path
    .toLowerCase()
    .replace(/[/{}]/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  const suffix = generateSlug().slice(0, 4);
  return [method, pathPart, suffix].filter(Boolean).join("-");
}
