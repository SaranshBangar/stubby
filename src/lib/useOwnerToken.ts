"use client";
import { useEffect, useState } from "react";
import { generateToken, isValidToken } from "@/lib/token";

const STORAGE_KEY = "stubby_owner_token";

/**
 * Client-side anonymous identity. On first ever visit we mint a token and
 * persist it in localStorage; thereafter it's reused. This token scopes all
 * of the browser's mocks/monitors and is sent on every API call.
 *
 * Returns null until hydrated (avoids SSR/client mismatch) — components
 * should treat null as "loading".
 */
export function useOwnerToken(): string | null {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let t = localStorage.getItem(STORAGE_KEY);
    if (!isValidToken(t)) {
      t = generateToken();
      localStorage.setItem(STORAGE_KEY, t);
    }
    setToken(t);
  }, []);

  return token;
}

export function readOwnerToken(): string | null {
  if (typeof window === "undefined") return null;
  const t = localStorage.getItem(STORAGE_KEY);
  return isValidToken(t) ? t : null;
}
