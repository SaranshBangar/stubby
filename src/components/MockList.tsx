"use client";
import { apiFetch } from "@/lib/api";
import type { MockRow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";

function mockUrl(slug: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.APP_URL ?? "");
  return `${base}/m/${slug}`;
}

function expiryLabel(expiresAt: number | null): string {
  if (expiresAt == null) return "persistent";
  const days = Math.max(0, Math.ceil((expiresAt - Date.now()) / 86_400_000));
  return days <= 0 ? "expired" : `expires in ${days}d`;
}

export function MockList({
  mocks,
  onDeleted,
}: {
  mocks: MockRow[];
  onDeleted: (id: string) => void;
}) {
  if (mocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No mocks yet. Create one above — it gets a live URL instantly.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {mocks.map((m) => {
        const url = mockUrl(m.slug);
        const curl = `curl -i ${url}`;
        return (
          <li key={m.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {m.status_code}
              </Badge>
              <code className="flex-1 truncate font-mono text-sm text-primary">
                /m/{m.slug}
              </code>
              <span className="text-xs text-muted-foreground">
                {m.delay_ms > 0 ? `${m.delay_ms}ms · ` : ""}
                {expiryLabel(m.expires_at)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-xs">
                {url}
              </code>
              <CopyButton value={url} label="URL" />
              <CopyButton value={curl} label="curl" />
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={async () => {
                  if (!confirm("Delete this mock?")) return;
                  await apiFetch(`/api/mocks/${m.id}`, { method: "DELETE" });
                  onDeleted(m.id);
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
