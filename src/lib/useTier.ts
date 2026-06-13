"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

/**
 * Client tier state for the current owner_token. Refetches whenever identity
 * changes (login/logout adopts a new token) or auth changes, so the header's
 * Pro badge stays in sync after an upgrade or sign-in.
 */
export function useTier() {
  const [tier, setTier] = useState<"free" | "pro" | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { tier } = await apiFetch<{ tier: "free" | "pro" }>("/api/tier");
      setTier(tier);
    } catch {
      setTier("free");
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("stubby:owner-token-changed", onChange);
    window.addEventListener("stubby:auth-changed", onChange);
    return () => {
      window.removeEventListener("stubby:owner-token-changed", onChange);
      window.removeEventListener("stubby:auth-changed", onChange);
    };
  }, [refresh]);

  return { tier, isPro: tier === "pro", loading: tier === null, refresh };
}
