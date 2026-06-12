"use client";
import { apiFetch } from "@/lib/api";
import type { WebhookEndpointRow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { webhookUrl } from "@/components/WebhookCreateForm";

export type WebhookEndpointWithCount = WebhookEndpointRow & {
  request_count?: number;
};

function expiryLabel(expiresAt: number | null): string {
  if (expiresAt == null) return "persistent";
  const days = Math.max(0, Math.ceil((expiresAt - Date.now()) / 86_400_000));
  return days <= 0 ? "expired" : `expires in ${days}d`;
}

export function WebhookList({
  endpoints,
  selectedId,
  onSelect,
  onDeleted,
}: {
  endpoints: WebhookEndpointWithCount[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  if (endpoints.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No endpoints yet. Create one above - anything sent to its URL shows up
        here in real time.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {endpoints.map((e) => {
        const url = webhookUrl(e.id);
        const selected = e.id === selectedId;
        return (
          <li
            key={e.id}
            className={`rounded-lg border p-4 ${
              selected ? "border-brand" : "border-border"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {e.request_count ?? 0} req
              </Badge>
              <span className="flex-1 truncate text-sm text-t1">
                {e.label || <span className="text-t3">(unlabeled)</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                {expiryLabel(e.expires_at)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-xs">
                {url}
              </code>
              <CopyButton value={url} label="URL" />
              <Button
                variant={selected ? "secondary" : "outline"}
                size="sm"
                onClick={() => onSelect(e.id)}
              >
                {selected ? "Viewing" : "View requests"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={async () => {
                  if (!confirm("Delete this endpoint and all captured requests?"))
                    return;
                  await apiFetch(`/api/webhooks/${e.id}`, { method: "DELETE" });
                  onDeleted(e.id);
                }}
              >
                Delete
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
