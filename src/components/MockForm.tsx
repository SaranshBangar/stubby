"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { MockRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface HeaderPair {
  key: string;
  value: string;
}

export function MockForm({ onCreated }: { onCreated: (m: MockRow) => void }) {
  const [statusCode, setStatusCode] = useState("200");
  const [delayMs, setDelayMs] = useState("0");
  const [bodyText, setBodyText] = useState('{\n  "hello": "world"\n}');
  const [headers, setHeaders] = useState<HeaderPair[]>([{ key: "", value: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setHeader(i: number, patch: Partial<HeaderPair>) {
    setHeaders((h) => h.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function addHeader() {
    setHeaders((h) => [...h, { key: "", value: "" }]);
  }
  function removeHeader(i: number) {
    setHeaders((h) => h.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate JSON body client-side for a fast error.
    let parsedBody: unknown;
    try {
      parsedBody = bodyText.trim() === "" ? {} : JSON.parse(bodyText);
    } catch {
      setError("Response body is not valid JSON.");
      return;
    }

    const headerObj: Record<string, string> = {};
    for (const { key, value } of headers) {
      if (key.trim()) headerObj[key.trim()] = value;
    }

    setBusy(true);
    try {
      const { mock } = await apiFetch<{ mock: MockRow }>("/api/mocks", {
        method: "POST",
        body: JSON.stringify({
          status_code: Number(statusCode),
          delay_ms: Number(delayMs),
          headers: headerObj,
          body: parsedBody,
        }),
      });
      onCreated(mock);
      // Reset body to a fresh template; keep status/headers for convenience.
      setBodyText('{\n  "hello": "world"\n}');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create mock");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="status">Status code</Label>
          <Input
            id="status"
            inputMode="numeric"
            value={statusCode}
            onChange={(e) => setStatusCode(e.target.value)}
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="delay">Delay (ms)</Label>
          <Input
            id="delay"
            inputMode="numeric"
            value={delayMs}
            onChange={(e) => setDelayMs(e.target.value)}
            className="font-mono"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">Response body (JSON)</Label>
        <Textarea
          id="body"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={8}
          spellCheck={false}
          className="font-mono text-xs text-code"
        />
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-t1">
            Variables reference - tokens resolved fresh on every request
          </summary>
          <dl className="mt-2 grid gap-x-4 gap-y-0.5 font-mono sm:grid-cols-2">
            {[
              ["{{uuid}}", "new UUID v4"],
              ["{{timestamp}}", "current ISO 8601 datetime"],
              ["{{timestamp_unix}}", "current Unix epoch (s)"],
              ["{{random_int}}", "random integer 0–9999"],
              ["{{random_int:N:M}}", "random integer N–M"],
              ["{{random_float}}", "random float 0.00–1.00"],
              ["{{random_bool}}", "true or false"],
              ["{{random_name}}", "a random full name"],
              ["{{random_email}}", "a random email"],
              ["{{random_url}}", "a plausible https URL"],
              ["{{lorem:N}}", "N words of lorem ipsum"],
              ["{{request_method}}", "incoming HTTP method"],
              ["{{request_ip}}", "requester's IP"],
              ["{{request_header:X}}", "value of header X"],
              ["{{request_query:X}}", "value of query param X"],
            ].map(([token, desc]) => (
              <div key={token} className="flex gap-2">
                <code className="text-code">{token}</code>
                <span>{desc}</span>
              </div>
            ))}
          </dl>
        </details>
      </div>

      <div className="space-y-2">
        <Label>Custom headers</Label>
        {headers.map((h, i) => (
          <div key={i} className="flex gap-2">
            <Input
              placeholder="X-Header-Name"
              value={h.key}
              onChange={(e) => setHeader(i, { key: e.target.value })}
              className="font-mono text-xs"
            />
            <Input
              placeholder="value"
              value={h.value}
              onChange={(e) => setHeader(i, { value: e.target.value })}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeHeader(i)}
              aria-label="Remove header"
            >
              ×
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addHeader}>
          + Add header
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Creating…" : "Create mock endpoint"}
      </Button>
    </form>
  );
}
