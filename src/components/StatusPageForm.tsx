"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  MonitorRow,
  StatusPageRow,
  StatusPageMonitorRow,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type StatusPageWithMonitors = StatusPageRow & {
  monitors: StatusPageMonitorRow[];
};

interface Pick {
  selected: boolean;
  display_label: string;
}

export function StatusPageForm({
  page,
  onSaved,
  onCancelEdit,
}: {
  /** Existing page to edit, or null to create. */
  page: StatusPageWithMonitors | null;
  onSaved: (p: StatusPageRow) => void;
  onCancelEdit?: () => void;
}) {
  const [monitors, setMonitors] = useState<MonitorRow[]>([]);
  const [title, setTitle] = useState(page?.title ?? "");
  const [description, setDescription] = useState(page?.description ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [showPoweredBy, setShowPoweredBy] = useState(
    page ? page.show_powered_by === 1 : true,
  );
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ monitors: MonitorRow[] }>("/api/monitors")
      .then((d) => setMonitors(d.monitors))
      .catch(() => setMonitors([]));
  }, []);

  // Seed picks from the page being edited.
  useEffect(() => {
    if (!page) return;
    const seeded: Record<string, Pick> = {};
    for (const m of page.monitors) {
      seeded[m.monitor_id] = {
        selected: true,
        display_label: m.display_label ?? "",
      };
    }
    setPicks(seeded);
  }, [page]);

  function setPick(id: string, patch: Partial<Pick>) {
    setPicks((p) => {
      const prev = p[id] ?? { selected: false, display_label: "" };
      return { ...p, [id]: { ...prev, ...patch } };
    });
  }

  const publicUrl =
    typeof window !== "undefined" && slug
      ? `${window.location.origin}/status/${slug}`
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const selection = monitors
      .filter((m) => picks[m.id]?.selected)
      .map((m) => ({
        monitor_id: m.id,
        display_label: picks[m.id]?.display_label.trim() || null,
      }));

    setBusy(true);
    try {
      const payload = JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        slug: slug.trim(),
        show_powered_by: showPoweredBy,
        monitors: selection,
      });
      const { page: saved } = page
        ? await apiFetch<{ page: StatusPageRow }>(`/api/status-pages/${page.id}`, {
            method: "PUT",
            body: payload,
          })
        : await apiFetch<{ page: StatusPageRow }>("/api/status-pages", {
            method: "POST",
            body: payload,
          });
      onSaved(saved);
      if (!page) {
        setTitle("");
        setDescription("");
        setSlug("");
        setPicks({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save page");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sp-title">Title</Label>
          <Input
            id="sp-title"
            required
            placeholder="Acme Systems Status"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sp-slug">Slug</Label>
          <Input
            id="sp-slug"
            required
            placeholder="acme"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            className="font-mono"
          />
          {publicUrl && (
            <p className="break-all font-mono text-xs text-muted-foreground">
              {publicUrl}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sp-desc">Description (optional)</Label>
        <Textarea
          id="sp-desc"
          rows={2}
          placeholder="Live status of our public services."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Monitors to show</Label>
        {monitors.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No monitors yet - add one on the Uptime Monitors tab first.
          </p>
        ) : (
          monitors.map((m) => {
            const pick = picks[m.id];
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-2">
                <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-[var(--accent)]"
                    checked={pick?.selected ?? false}
                    onChange={(e) => setPick(m.id, { selected: e.target.checked })}
                  />
                  <code className="truncate font-mono text-xs">{m.target_url}</code>
                </label>
                {pick?.selected && (
                  <Input
                    placeholder="Public label (optional)"
                    value={pick.display_label}
                    onChange={(e) => setPick(m.id, { display_label: e.target.value })}
                    className="h-8 w-56 text-xs"
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-t2">
        <input
          type="checkbox"
          className="accent-[var(--accent)]"
          checked={showPoweredBy}
          onChange={(e) => setShowPoweredBy(e.target.checked)}
        />
        Show &quot;Powered by Stubby&quot; badge
        <span className="text-xs text-t3">(always shown on the free plan)</span>
      </label>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="flex-1">
          {busy ? "Saving…" : page ? "Save changes" : "Publish status page"}
        </Button>
        {page && onCancelEdit && (
          <Button type="button" variant="outline" onClick={onCancelEdit}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
