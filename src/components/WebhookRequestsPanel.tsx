"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { WebhookRequestRow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { webhookUrl } from "@/components/WebhookCreateForm";

const POLL_MS = 3000;

// Method -> badge color. Matches the existing badge variants.
function methodVariant(
  method: string,
): "up" | "default" | "pending" | "down" | "secondary" {
  switch (method.toUpperCase()) {
    case "GET":
      return "up";
    case "POST":
      return "default";
    case "PUT":
    case "PATCH":
      return "pending";
    case "DELETE":
      return "down";
    default:
      return "secondary";
  }
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseJsonObject(raw: string): Record<string, string> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

function isJsonContentType(ct: string | null): boolean {
  return ct != null && /json/i.test(ct);
}

function prettyJson(raw: string): string | null {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return null;
  }
}

// Reconstruct the captured request as a runnable curl command.
function buildCurl(r: WebhookRequestRow, slug: string): string {
  const query = parseJsonObject(r.query_json);
  const qs = new URLSearchParams(query).toString();
  const url = `${webhookUrl(slug)}${r.path === "/" ? "" : r.path}${qs ? `?${qs}` : ""}`;
  const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

  const parts = [`curl -X ${r.method} ${sq(url)}`];
  const headers = parseJsonObject(r.headers_json);
  // Hop-by-hop / derived headers would break replay; skip them.
  const skip = new Set(["host", "content-length", "connection", "accept-encoding"]);
  for (const [k, v] of Object.entries(headers)) {
    if (skip.has(k.toLowerCase())) continue;
    parts.push(`-H ${sq(`${k}: ${v}`)}`);
  }
  if (r.body_raw) parts.push(`--data-raw ${sq(r.body_raw)}`);
  return parts.join(" \\\n  ");
}

function KvTable({ data }: { data: Record<string, string> }) {
  const entries = Object.entries(data);
  if (entries.length === 0)
    return <p className="text-xs text-muted-foreground">none</p>;
  return (
    <table className="w-full text-left font-mono text-xs">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-border/50 last:border-0">
            <td className="whitespace-nowrap py-1 pr-4 align-top text-t2">{k}</td>
            <td className="break-all py-1 text-t1">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RequestDetail({
  r,
  slug,
  onDeleted,
}: {
  r: WebhookRequestRow;
  slug: string;
  onDeleted: () => void;
}) {
  const pretty = isJsonContentType(r.content_type) ? prettyJson(r.body_raw) : null;
  const [showPretty, setShowPretty] = useState(pretty != null);
  const query = parseJsonObject(r.query_json);
  const qs = new URLSearchParams(query).toString();
  const fullUrl = `${webhookUrl(slug)}${r.path === "/" ? "" : r.path}${qs ? `?${qs}` : ""}`;

  return (
    <div className="mt-3 space-y-4 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-xs">
          {r.method} {fullUrl}
        </code>
        <CopyButton value={buildCurl(r, slug)} label="curl" />
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={async () => {
            await apiFetch(`/api/webhooks/${slug}/requests/${r.id}`, {
              method: "DELETE",
            });
            onDeleted();
          }}
        >
          Delete
        </Button>
      </div>

      <div>
        <h4 className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-t3">
          Headers
        </h4>
        <KvTable data={parseJsonObject(r.headers_json)} />
      </div>

      <div>
        <h4 className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-t3">
          Query params
        </h4>
        <KvTable data={query} />
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <h4 className="font-mono text-[11px] uppercase tracking-wider text-t3">
            Body{r.body_size > 0 ? ` (${fmtSize(r.body_size)})` : ""}
          </h4>
          {pretty != null && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setShowPretty((p) => !p)}
            >
              {showPretty ? "raw" : "pretty"}
            </Button>
          )}
        </div>
        {r.body_raw ? (
          <pre className="max-h-80 overflow-auto rounded bg-muted px-3 py-2 font-mono text-xs text-code">
            {showPretty && pretty != null ? pretty : r.body_raw}
          </pre>
        ) : (
          <p className="text-xs text-muted-foreground">empty</p>
        )}
      </div>
    </div>
  );
}

export function WebhookRequestsPanel({ endpointId }: { endpointId: string }) {
  const [requests, setRequests] = useState<WebhookRequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ requests: WebhookRequestRow[]; total: number }>(
        `/api/webhooks/${endpointId}/requests?limit=50`,
      );
      setRequests(d.requests);
      setTotal(d.total);
    } catch {
      /* transient poll failure - keep last data */
    } finally {
      setLoading(false);
    }
  }, [endpointId]);

  // Poll for new requests while the panel is open.
  useEffect(() => {
    setLoading(true);
    setExpandedId(null);
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return <p className="text-sm text-t2">Loading…</p>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {total} request{total === 1 ? "" : "s"} captured
          <span className="pulse ml-2 inline-block h-1.5 w-1.5 rounded-full bg-success align-middle" />
          <span className="ml-1.5">live</span>
        </span>
        {total > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!confirm("Clear all captured requests?")) return;
              await apiFetch(`/api/webhooks/${endpointId}/requests`, {
                method: "DELETE",
              });
              load();
            }}
          >
            Clear all
          </Button>
        )}
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Waiting for requests… send anything to the endpoint URL and it will
          appear here within a few seconds.
        </p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => {
            const expanded = expandedId === r.id;
            return (
              <li
                key={r.id}
                className={`rounded-lg border p-3 ${
                  expanded ? "border-brand" : "border-border"
                }`}
              >
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-2 text-left"
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                >
                  <Badge variant={methodVariant(r.method)} className="font-mono">
                    {r.method}
                  </Badge>
                  <code className="flex-1 truncate font-mono text-sm">
                    {r.path}
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {r.content_type ? `${r.content_type.split(";")[0]} · ` : ""}
                    {fmtSize(r.body_size)} ·{" "}
                    {new Date(r.received_at).toLocaleTimeString()}
                  </span>
                </button>
                {expanded && (
                  <RequestDetail r={r} slug={endpointId} onDeleted={load} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
