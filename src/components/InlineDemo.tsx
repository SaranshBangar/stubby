"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useOwnerToken } from "@/lib/useOwnerToken";
import type { MockRow } from "@/lib/types";
import { CopyButton } from "@/components/CopyButton";

const DEMO_JSON = `{
  "user": {
    "id": 42,
    "name": "Jane Doe",
    "email": "jane@acme.io",
    "role": "admin"
  },
  "status": "active"
}`;

// Live, functional demo styled as the design's split panel: edit JSON on the
// left, get a real /m/<slug> endpoint on the right. Same anon-token flow as the
// full builder — no signup, exactly the product promise.
export function InlineDemo() {
  useOwnerToken();
  const [body, setBody] = useState(DEMO_JSON);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      setError("That isn't valid JSON.");
      return;
    }
    setBusy(true);
    try {
      const { mock } = await apiFetch<{ mock: MockRow }>("/api/mocks", {
        method: "POST",
        body: JSON.stringify({ body: parsed, status_code: 200 }),
      });
      setUrl(`${window.location.origin}/m/${mock.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-md border border-b1 bg-s1 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.55)] md:grid-cols-2">
      {/* LEFT — form */}
      <div className="border-b border-b1 md:border-b-0 md:border-r">
        <div className="flex items-center gap-1.5 border-b border-b1 bg-s2 px-3.5 py-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff5f57]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#febc2e]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#28c840]" />
          <span className="ml-1 font-mono text-[11px] text-t3">mock-builder</span>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-2 gap-2.5">
            <Mini label="Status" value="200" mono />
            <Mini label="Delay" value="None" />
          </div>
          <div>
            <FieldLabel>Response body</FieldLabel>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              spellCheck={false}
              aria-label="Demo JSON body"
              className="w-full resize-none rounded-sm border border-b1 bg-s2 px-3 py-2.5 font-mono text-xs leading-relaxed text-code outline-none focus:border-brand"
            />
          </div>
          <button
            onClick={create}
            disabled={busy}
            className="rounded-sm bg-brand py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-default disabled:bg-s3 disabled:text-t2"
          >
            {busy ? "Generating…" : "Create Endpoint →"}
          </button>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </div>

      {/* RIGHT — result */}
      <div>
        <div className="flex items-center gap-1.5 border-b border-b1 bg-s2 px-3.5 py-2.5">
          <span className="font-mono text-[11px] text-t3">result</span>
          {url && (
            <span className="pulse ml-auto font-mono text-[11px] text-success">
              ● live
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3 p-4">
          {url ? (
            <>
              <div>
                <FieldLabel>Your endpoint</FieldLabel>
                <div className="flex items-center overflow-hidden rounded-sm border border-b2 bg-s2">
                  <code className="flex-1 truncate px-2.5 py-2 font-mono text-xs text-brand">
                    {url}
                  </code>
                  <CopyButton value={url} size="icon" />
                </div>
              </div>
              <div>
                <FieldLabel>Try it</FieldLabel>
                <pre className="overflow-auto rounded-sm border border-b1 bg-background px-3 py-2.5 font-mono text-xs leading-relaxed text-t2">
                  {`$ curl -s ${url}\n\n← HTTP/1.1 200 OK\n← Content-Type: application/json`}
                </pre>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-brand underline-offset-4 hover:underline"
              >
                open it →
              </a>
            </>
          ) : (
            <div className="flex h-[180px] flex-col items-center justify-center gap-2 font-mono text-xs text-t3">
              <span className="text-2xl opacity-30">◌</span>
              <span>endpoint will appear here</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-t2">
      {children}
    </div>
  );
}

function Mini({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        className={`rounded-sm border border-b1 bg-s2 px-2.5 py-1.5 text-[13px] text-t1 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
