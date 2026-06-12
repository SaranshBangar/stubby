"use client";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import type { StatusPageWithMonitors } from "@/components/StatusPageForm";

function pageUrl(slug: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.APP_URL ?? "");
  return `${base}/status/${slug}`;
}

export function StatusPageList({
  pages,
  onEdit,
  onDeleted,
}: {
  pages: StatusPageWithMonitors[];
  onEdit: (p: StatusPageWithMonitors) => void;
  onDeleted: (id: string) => void;
}) {
  if (pages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No status pages yet. Publish one above - it gets a public URL anyone
        can view.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {pages.map((p) => {
        const url = pageUrl(p.slug);
        return (
          <li key={p.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {p.monitors.length} monitor{p.monitors.length === 1 ? "" : "s"}
              </Badge>
              <span className="flex-1 truncate text-sm text-t1">{p.title}</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-xs">
                {url}
              </code>
              <CopyButton value={url} label="URL" />
              <Button asChild variant="outline" size="sm">
                <a href={`/status/${p.slug}`} target="_blank" rel="noreferrer">
                  Preview
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={() => onEdit(p)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={async () => {
                  if (!confirm("Delete this status page?")) return;
                  await apiFetch(`/api/status-pages/${p.id}`, { method: "DELETE" });
                  onDeleted(p.id);
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
