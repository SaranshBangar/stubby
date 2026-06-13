"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useOwnerToken } from "@/lib/useOwnerToken";
import type { MonitorRow } from "@/lib/types";
import { SiteHeader } from "@/components/SiteHeader";
import { MonitorForm } from "@/components/MonitorForm";
import { MonitorList } from "@/components/MonitorList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProAwareSubtitle } from "@/components/ProAwareSubtitle";

export default function MonitorPage() {
  const token = useOwnerToken();
  const [monitors, setMonitors] = useState<MonitorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ monitors: MonitorRow[] }>("/api/monitors")
      .then((d) => setMonitors(d.monitors))
      .catch(() => setMonitors([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="tool" />
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <h1 className="text-[22px] font-semibold tracking-tight text-t1">
          Uptime Monitors
        </h1>
        <ProAwareSubtitle
          free={
            <>
              We ping your URL on schedule and email you the moment it goes
              down. No signup.
            </>
          }
          pro={
            <>
              We ping your URL as often as every minute and alert you the moment
              it goes down. Thanks for going Pro!
            </>
          }
        />

        <Card className="mt-6 bg-s1">
          <CardHeader className="border-b border-b1">
            <CardTitle className="font-mono text-[11px] uppercase tracking-wider text-t3">
              Add a monitor
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <MonitorForm onCreated={(m) => setMonitors((p) => [m, ...p])} />
          </CardContent>
        </Card>

        <section className="mt-10">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-t3">
            Active monitors
          </h2>
          {loading ? (
            <p className="text-sm text-t2">Loading…</p>
          ) : (
            <MonitorList
              monitors={monitors}
              onDeleted={(id) =>
                setMonitors((p) => p.filter((m) => m.id !== id))
              }
            />
          )}
        </section>
      </main>
    </div>
  );
}
