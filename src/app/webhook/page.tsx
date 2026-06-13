"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useOwnerToken } from "@/lib/useOwnerToken";
import { SiteHeader } from "@/components/SiteHeader";
import { WebhookCreateForm } from "@/components/WebhookCreateForm";
import {
  WebhookList,
  type WebhookEndpointWithCount,
} from "@/components/WebhookList";
import { WebhookRequestsPanel } from "@/components/WebhookRequestsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProAwareSubtitle } from "@/components/ProAwareSubtitle";

export default function WebhookPage() {
  const token = useOwnerToken(); // mint/restore anon identity
  const [endpoints, setEndpoints] = useState<WebhookEndpointWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return; // wait for hydration
    apiFetch<{ endpoints: WebhookEndpointWithCount[] }>("/api/webhooks")
      .then((d) => setEndpoints(d.endpoints))
      .catch(() => setEndpoints([]))
      .finally(() => setLoading(false));
  }, [token]);

  const selected = endpoints.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="tool" />
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <h1 className="text-[22px] font-semibold tracking-tight text-t1">
          Webhook Inspector
        </h1>
        <ProAwareSubtitle
          free={
            <>
              Get a URL that captures anything sent to it - method, headers,
              body - and watch requests arrive live. No signup.
            </>
          }
          pro={
            <>
              Capture anything sent to your URL - method, headers, body - live.
              Your Pro endpoints keep far more stored requests. Thanks for going
              Pro!
            </>
          }
        />

        <Card className="mt-6 bg-s1">
          <CardHeader className="border-b border-b1">
            <CardTitle className="font-mono text-[11px] uppercase tracking-wider text-t3">
              New endpoint
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <WebhookCreateForm
              onCreated={(e) => {
                setEndpoints((prev) => [{ ...e, request_count: 0 }, ...prev]);
                setSelectedId(e.id);
              }}
            />
          </CardContent>
        </Card>

        <section className="mt-10">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-t3">
            Your endpoints
          </h2>
          {loading ? (
            <p className="text-sm text-t2">Loading…</p>
          ) : (
            <WebhookList
              endpoints={endpoints}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDeleted={(id) => {
                setEndpoints((prev) => prev.filter((e) => e.id !== id));
                if (selectedId === id) setSelectedId(null);
              }}
            />
          )}
        </section>

        {selected && (
          <section className="mt-10">
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-t3">
              Captured requests - {selected.label || `/w/${selected.id}`}
            </h2>
            <WebhookRequestsPanel endpointId={selected.id} />
          </section>
        )}
      </main>
    </div>
  );
}
