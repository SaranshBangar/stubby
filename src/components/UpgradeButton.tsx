"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useOwnerToken } from "@/lib/useOwnerToken";
import { Button } from "@/components/ui/button";

// Kicks off Stripe Checkout. The owner token is sent (via apiFetch header)
// and stashed in the Checkout session so the webhook can link payment->token.
export function UpgradeButton({
  className,
  children = "Upgrade to Pro",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  useOwnerToken(); // ensure token exists before checkout
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const { url } = await apiFetch<{ url: string }>("/api/checkout", {
        method: "POST",
      });
      window.location.href = url; // redirect to Stripe-hosted Checkout
    } catch {
      setBusy(false);
      alert("Could not start checkout. Check Stripe env vars.");
    }
  }

  return (
    <Button onClick={go} disabled={busy} className={className}>
      {busy ? "Redirecting…" : children}
    </Button>
  );
}
