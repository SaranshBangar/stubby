"use client";
import { useState } from "react";
import { Hash, MessageSquare, Webhook } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { AlertChannelRow, AlertChannelType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TYPE_ICONS: Record<AlertChannelType, React.ReactNode> = {
  slack: <Hash className="h-3.5 w-3.5" />,
  discord: <MessageSquare className="h-3.5 w-3.5" />,
  webhook: <Webhook className="h-3.5 w-3.5" />,
};

// Webhook URLs are secrets - show just enough to recognize them.
function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 12 ? `${u.pathname.slice(0, 12)}…` : u.pathname;
    return `${u.origin}${path}`;
  } catch {
    return `${url.slice(0, 24)}…`;
  }
}

function ChannelItem({
  c,
  onDeleted,
}: {
  c: AlertChannelRow;
  onDeleted: (id: string) => void;
}) {
  const [testState, setTestState] = useState<"idle" | "busy" | "ok" | "fail">(
    "idle",
  );

  async function test() {
    setTestState("busy");
    try {
      const { success } = await apiFetch<{ success: boolean }>(
        `/api/alert-channels/${c.id}/test`,
        { method: "POST" },
      );
      setTestState(success ? "ok" : "fail");
    } catch {
      setTestState("fail");
    }
    setTimeout(() => setTestState("idle"), 2500);
  }

  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1 font-mono">
          {TYPE_ICONS[c.type]}
          {c.type}
        </Badge>
        <span className="flex-1 truncate text-sm text-t1">{c.label}</span>
        <code className="truncate font-mono text-xs text-muted-foreground">
          {maskUrl(c.url)}
        </code>
        <Button
          variant="outline"
          size="sm"
          disabled={testState === "busy"}
          onClick={test}
        >
          {testState === "busy"
            ? "Sending…"
            : testState === "ok"
              ? "Sent ✓"
              : testState === "fail"
                ? "Failed ✗"
                : "Test"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={async () => {
            if (!confirm("Delete this alert channel?")) return;
            await apiFetch(`/api/alert-channels/${c.id}`, { method: "DELETE" });
            onDeleted(c.id);
          }}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}

export function AlertChannelList({
  channels,
  onDeleted,
}: {
  channels: AlertChannelRow[];
  onDeleted: (id: string) => void;
}) {
  if (channels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No channels yet. Add one above, then attach it to monitors on the
        Uptime Monitors tab.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {channels.map((c) => (
        <ChannelItem key={c.id} c={c} onDeleted={onDeleted} />
      ))}
    </ul>
  );
}
