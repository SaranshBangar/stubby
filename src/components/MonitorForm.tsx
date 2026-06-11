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
  const [keywordEnabled, setKeywordEnabled] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [keywordMode, setKeywordMode] = useState<"must_contain" | "must_not_contain">(
    "must_contain",
  );
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
            keyword_check_enabled: keywordEnabled,
            keyword_check_string: keywordEnabled ? keyword : undefined,
            keyword_check_mode: keywordEnabled ? keywordMode : undefined,
          }),
        },
      );
      onCreated(monitor);
      setUrl("");
      setKeywordEnabled(false);
      setKeyword("");
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

      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-[var(--accent)]"
            checked={keywordEnabled}
            onChange={(e) => setKeywordEnabled(e.target.checked)}
          />
          Keyword check
          <span className="text-xs text-muted-foreground">
            (fail the check based on the response body, even on HTTP 200)
          </span>
        </label>

        {keywordEnabled && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <Input
              placeholder='e.g. "status":"ok"'
              required
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="font-mono text-xs"
            />
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="keyword-mode"
                  className="accent-[var(--accent)]"
                  checked={keywordMode === "must_contain"}
                  onChange={() => setKeywordMode("must_contain")}
                />
                Page must contain this
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="keyword-mode"
                  className="accent-[var(--accent)]"
                  checked={keywordMode === "must_not_contain"}
                  onChange={() => setKeywordMode("must_not_contain")}
                />
                Page must NOT contain this
              </label>
            </div>
          </div>
        )}
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
