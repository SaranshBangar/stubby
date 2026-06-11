"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { MockRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ImportResult {
  created: number;
  skipped: number;
  mocks: MockRow[];
  reason?: string;
}

export function ImportOpenApiModal({
  onImported,
}: {
  onImported: (mocks: MockRow[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [specText, setSpecText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function close() {
    setOpen(false);
    setSpecText("");
    setFileName(null);
    setError(null);
    setResult(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSpecText(await file.text());
  }

  async function doImport() {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await apiFetch<ImportResult>("/api/mocks/import-openapi", {
        method: "POST",
        body: JSON.stringify({ spec: specText }),
      });
      setResult(res);
      if (res.mocks.length > 0) onImported(res.mocks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Import from OpenAPI spec
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-xl rounded-lg border border-border bg-s1 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-t3">
                Import from OpenAPI / Swagger
              </h3>
              <Button variant="ghost" size="icon" onClick={close} aria-label="Close">
                ×
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="oa-file">Upload a spec file</Label>
                <input
                  id="oa-file"
                  type="file"
                  accept=".json,.yaml,.yml"
                  onChange={onFile}
                  className="block w-full text-xs text-t2 file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-xs file:text-t1"
                />
                {fileName && (
                  <p className="text-xs text-muted-foreground">Loaded {fileName}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="oa-paste">…or paste the raw spec (JSON or YAML)</Label>
                <Textarea
                  id="oa-paste"
                  rows={8}
                  spellCheck={false}
                  placeholder={'{\n  "openapi": "3.0.0",\n  "paths": { … }\n}'}
                  value={specText}
                  onChange={(e) => setSpecText(e.target.value)}
                  className="font-mono text-xs text-code"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              {result && (
                <p className="text-sm text-t1">
                  Created {result.created} endpoint{result.created === 1 ? "" : "s"},
                  skipped {result.skipped}.
                  {result.reason && (
                    <span className="block text-xs text-muted-foreground">
                      {result.reason}
                    </span>
                  )}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={doImport}
                  disabled={busy || !specText.trim()}
                  className="flex-1"
                >
                  {busy ? "Importing…" : "Import"}
                </Button>
                <Button variant="outline" onClick={close}>
                  {result ? "Done" : "Cancel"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
