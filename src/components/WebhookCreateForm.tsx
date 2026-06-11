"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { WebhookEndpointRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/components/CopyButton";

export function webhookUrl(slug: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.APP_URL ?? "");
  return `${base}/w/${slug}`;
}

export function WebhookCreateForm({
  onCreated,
}: {
  onCreated: (e: WebhookEndpointRow) => void;
}) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { endpoint } = await apiFetch<{ endpoint: WebhookEndpointRow }>(
        "/api/webhooks",
        { method: "POST", body: JSON.stringify({ label: label.trim() }) },
      );
      onCreated(endpoint);
      setCreatedSlug(endpoint.id);
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create endpoint");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="wh-label">Label (optional)</Label>
        <Input
          id="wh-label"
          placeholder="e.g. Stripe events"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Creating…" : "Create endpoint"}
      </Button>

      {createdSlug && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 p-3">
          <span className="text-xs text-muted-foreground">
            Send anything to:
          </span>
          <code className="flex-1 overflow-x-auto font-mono text-xs text-primary">
            {webhookUrl(createdSlug)}
          </code>
          <CopyButton value={webhookUrl(createdSlug)} label="URL" />
        </div>
      )}
    </form>
  );
}
