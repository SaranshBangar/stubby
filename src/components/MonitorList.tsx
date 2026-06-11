"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { MonitorRow, CheckRow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkline } from "@/components/Sparkline";
import { SslBadge, SslSection } from "@/components/SslSection";

function ago(ts: number | null): string {
  if (ts == null) return "never";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function MonitorItem({
  m,
  onDeleted,
}: {
  m: MonitorRow;
  onDeleted: (id: string) => void;
}) {
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [showSsl, setShowSsl] = useState(false);

  useEffect(() => {
    apiFetch<{ checks: CheckRow[] }>(`/api/monitors/${m.id}/checks`)
      .then((d) => setChecks(d.checks))
      .catch(() => setChecks([]));
  }, [m.id, m.last_checked_at]);

  const up = m.is_up === 1;

  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={up ? "up" : "down"}>{up ? "UP" : "DOWN"}</Badge>
        <SslBadge m={m} />
        <code className="flex-1 truncate font-mono text-sm">{m.target_url}</code>
        <span className="text-xs text-muted-foreground">
          every {m.interval_minutes}m · checked {ago(m.last_checked_at)}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <Sparkline checks={checks} />
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {m.last_status != null ? `HTTP ${m.last_status}` : "—"}
          </span>
          {m.target_url.startsWith("https://") && (
            <Button
              variant={showSsl ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowSsl((p) => !p)}
            >
              SSL
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={async () => {
              if (!confirm("Delete this monitor?")) return;
              await apiFetch(`/api/monitors/${m.id}`, { method: "DELETE" });
              onDeleted(m.id);
            }}
          >
            Delete
          </Button>
        </div>
      </div>

      {showSsl && <SslSection m={m} />}
    </li>
  );
}

export function MonitorList({
  monitors,
  onDeleted,
}: {
  monitors: MonitorRow[];
  onDeleted: (id: string) => void;
}) {
  if (monitors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No monitors yet. Add a URL above — we&apos;ll ping it on schedule and
        email you if it goes down.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {monitors.map((m) => (
        <MonitorItem key={m.id} m={m} onDeleted={onDeleted} />
      ))}
    </ul>
  );
}
