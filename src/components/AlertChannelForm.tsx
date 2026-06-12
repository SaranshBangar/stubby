"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { AlertChannelRow, AlertChannelType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPE_HINTS: Record<AlertChannelType, string> = {
  slack: "Slack → App settings → Incoming Webhooks → copy the URL",
  discord: "Discord → Channel settings → Integrations → Webhooks → copy the URL",
  webhook: "Any HTTPS endpoint - we POST a JSON payload on each alert",
};

export function AlertChannelForm({
  onCreated,
}: {
  onCreated: (c: AlertChannelRow) => void;
}) {
  const [type, setType] = useState<AlertChannelType>("slack");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { channel } = await apiFetch<{ channel: AlertChannelRow }>(
        "/api/alert-channels",
        {
          method: "POST",
          body: JSON.stringify({ type, label: label.trim(), url: url.trim() }),
        },
      );
      onCreated(channel);
      setLabel("");
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save channel");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ch-type">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as AlertChannelType)}>
            <SelectTrigger id="ch-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slack">Slack</SelectItem>
              <SelectItem value="discord">Discord</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ch-label">Label</Label>
          <Input
            id="ch-label"
            required
            placeholder="Team Slack #alerts"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ch-url">Webhook URL</Label>
        <Input
          id="ch-url"
          type="url"
          required
          placeholder="https://hooks.slack.com/services/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">{TYPE_HINTS[type]}</p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Saving…" : "Add channel"}
      </Button>
    </form>
  );
}
