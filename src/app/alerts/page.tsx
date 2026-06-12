"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useOwnerToken } from "@/lib/useOwnerToken";
import type { AlertChannelRow } from "@/lib/types";
import { SiteHeader } from "@/components/SiteHeader";
import { AlertChannelForm } from "@/components/AlertChannelForm";
import { AlertChannelList } from "@/components/AlertChannelList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AlertsPage() {
  const token = useOwnerToken(); // mint/restore anon identity
  const [channels, setChannels] = useState<AlertChannelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return; // wait for hydration
    apiFetch<{ channels: AlertChannelRow[] }>("/api/alert-channels")
      .then((d) => setChannels(d.channels))
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="tool" />
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <h1 className="text-[22px] font-semibold tracking-tight text-t1">
          Alert Channels
        </h1>
        <p className="mt-1 text-[13.5px] text-t2">
          Get monitor alerts in Slack, Discord, or any webhook - in addition to
          email. Attach channels to monitors when you create or edit them.
        </p>

        <Card className="mt-6 bg-s1">
          <CardHeader className="border-b border-b1">
            <CardTitle className="font-mono text-[11px] uppercase tracking-wider text-t3">
              Add channel
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <AlertChannelForm
              onCreated={(c) => setChannels((prev) => [c, ...prev])}
            />
          </CardContent>
        </Card>

        <section className="mt-10">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-t3">
            Your channels
          </h2>
          {loading ? (
            <p className="text-sm text-t2">Loading…</p>
          ) : (
            <AlertChannelList
              channels={channels}
              onDeleted={(id) =>
                setChannels((prev) => prev.filter((c) => c.id !== id))
              }
            />
          )}
        </section>
      </main>
    </div>
  );
}
