"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useOwnerToken } from "@/lib/useOwnerToken";
import type { MockRow } from "@/lib/types";
import { SiteHeader } from "@/components/SiteHeader";
import { MockForm } from "@/components/MockForm";
import { MockList } from "@/components/MockList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MockPage() {
  const token = useOwnerToken(); // mint/restore anon identity
  const [mocks, setMocks] = useState<MockRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return; // wait for hydration
    apiFetch<{ mocks: MockRow[] }>("/api/mocks")
      .then((d) => setMocks(d.mocks))
      .catch(() => setMocks([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="tool" />
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <h1 className="text-[22px] font-semibold tracking-tight text-t1">
          Mock Builder
        </h1>
        <p className="mt-1 text-[13.5px] text-t2">
          Paste a JSON response body and get a stable, shareable URL. No signup.
        </p>

        <Card className="mt-6 bg-s1">
          <CardHeader className="border-b border-b1">
            <CardTitle className="font-mono text-[11px] uppercase tracking-wider text-t3">
              New endpoint
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <MockForm onCreated={(m) => setMocks((prev) => [m, ...prev])} />
          </CardContent>
        </Card>

        <section className="mt-10">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-t3">
            Your mocks
          </h2>
          {loading ? (
            <p className="text-sm text-t2">Loading…</p>
          ) : (
            <MockList
              mocks={mocks}
              onDeleted={(id) =>
                setMocks((prev) => prev.filter((m) => m.id !== id))
              }
            />
          )}
        </section>
      </main>
    </div>
  );
}
