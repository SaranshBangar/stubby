"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useOwnerToken } from "@/lib/useOwnerToken";
import { SiteHeader } from "@/components/SiteHeader";
import {
  StatusPageForm,
  type StatusPageWithMonitors,
} from "@/components/StatusPageForm";
import { StatusPageList } from "@/components/StatusPageList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StatusPageBuilderPage() {
  const token = useOwnerToken(); // mint/restore anon identity
  const [pages, setPages] = useState<StatusPageWithMonitors[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StatusPageWithMonitors | null>(null);

  const load = useCallback(() => {
    apiFetch<{ pages: StatusPageWithMonitors[] }>("/api/status-pages")
      .then((d) => setPages(d.pages))
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!token) return; // wait for hydration
    load();
  }, [token, load]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="tool" />
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <h1 className="text-[22px] font-semibold tracking-tight text-t1">
          Status Pages
        </h1>
        <p className="mt-1 text-[13.5px] text-t2">
          Publish a public page showing the live state and uptime history of
          the monitors you choose. No signup.
        </p>

        <Card className="mt-6 bg-s1">
          <CardHeader className="border-b border-b1">
            <CardTitle className="font-mono text-[11px] uppercase tracking-wider text-t3">
              {editing ? `Edit - ${editing.title}` : "New status page"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <StatusPageForm
              key={editing?.id ?? "new"}
              page={editing}
              onSaved={() => {
                setEditing(null);
                load();
              }}
              onCancelEdit={() => setEditing(null)}
            />
          </CardContent>
        </Card>

        <section className="mt-10">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-t3">
            Your status pages
          </h2>
          {loading ? (
            <p className="text-sm text-t2">Loading…</p>
          ) : (
            <StatusPageList
              pages={pages}
              onEdit={(p) => {
                setEditing(p);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onDeleted={(id) => {
                setPages((prev) => prev.filter((p) => p.id !== id));
                if (editing?.id === id) setEditing(null);
              }}
            />
          )}
        </section>
      </main>
    </div>
  );
}
