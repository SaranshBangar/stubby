"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { MonitorRow } from "@/lib/types";
import { INTERVAL_CHOICES } from "@/config/limits";
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

// Free tier floors interval at 15min; we show all choices but the server
// clamps (and we hint it in the UI).
export function MonitorForm({
  onCreated,
}: {
  onCreated: (m: MonitorRow) => void;
}) {
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState("15");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { monitor } = await apiFetch<{ monitor: MonitorRow }>(
        "/api/monitors",
        {
          method: "POST",
          body: JSON.stringify({
            target_url: url.trim(),
            interval_minutes: Number(interval),
            alert_email: email.trim(),
          }),
        },
      );
      onCreated(monitor);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create monitor");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="url">URL to monitor</Label>
        <Input
          id="url"
          type="url"
          required
          placeholder="https://api.example.com/health"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="interval">Check interval</Label>
          <Select value={interval} onValueChange={setInterval}>
            <SelectTrigger id="interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_CHOICES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  every {n} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Free tier runs at ≥15 min; Pro unlocks 1 min.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Alert email</Label>
          <Input
            id="email"
            type="email"
            required
            placeholder="you@dev.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="font-mono"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Creating…" : "Start monitoring"}
      </Button>
    </form>
  );
}
