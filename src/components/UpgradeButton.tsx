"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useOwnerToken } from "@/lib/useOwnerToken";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Cashfree?: (opts: { mode: string }) => {
      checkout: (opts: {
        paymentSessionId: string;
        redirectTarget: string;
      }) => Promise<{ error?: unknown; redirect?: boolean; paymentDetails?: unknown }>;
    };
  }
}

let cfScriptLoaded = false;
function loadCashfreeSDK(): Promise<void> {
  if (cfScriptLoaded && window.Cashfree) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="sdk.cashfree.com"]')) {
      cfScriptLoaded = true;
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.onload = () => { cfScriptLoaded = true; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/**
 * Opens Cashfree checkout for the one-time ₹99 lifetime Pro purchase.
 * Loads Cashfree.js v3 → creates an order via /api/checkout → redirects to
 * Cashfree-hosted payment page. Webhook at /api/cashfree/webhook grants Pro.
 */
export function UpgradeButton({
  className,
  children = "Upgrade to Pro",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  useOwnerToken();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await loadCashfreeSDK();
      const { payment_session_id } = await apiFetch<{ payment_session_id: string }>(
        "/api/checkout",
        { method: "POST" },
      );
      const cashfree = window.Cashfree!({ mode: "production" });
      await cashfree.checkout({
        paymentSessionId: payment_session_id,
        redirectTarget: "_self",
      });
      // _self redirects away — setBusy(false) intentionally not called.
    } catch {
      setBusy(false);
      alert("Could not start checkout. Please try again.");
    }
  }

  return (
    <Button onClick={go} disabled={busy} className={className}>
      {busy ? "Redirecting…" : children}
    </Button>
  );
}
