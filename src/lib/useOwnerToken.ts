"use client";
import { useEffect, useState } from "react";
import { generateToken, isValidToken } from "@/lib/token";

const STORAGE_KEY = "stubby_owner_token";
// Fired when the active owner_token changes (login adopts the account's
// canonical token; logout mints a fresh anonymous one). Lets tool pages and
// the header re-render / refetch against the new identity.
const CHANGE_EVENT = "stubby:owner-token-changed";

/**
 * Client-side identity. On first visit we mint an anonymous token and persist
 * it in localStorage; thereafter it's reused. Signing in REPLACES it with the
 * account's canonical token (see useAuth) so the same resources load on every
 * device. This token scopes all API calls (sent as x-owner-token).
 *
 * Returns null until hydrated (avoids SSR/client mismatch) — treat as loading.
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

    const sync = () => setToken(readOwnerToken());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync); // other tabs
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return token;
}

export function readOwnerToken(): string | null {
  if (typeof window === "undefined") return null;
  const t = localStorage.getItem(STORAGE_KEY);
  return isValidToken(t) ? t : null;
}

/** Adopt a specific token (the account's canonical one) on login. */
export function writeOwnerToken(token: string): void {
  if (typeof window === "undefined" || !isValidToken(token)) return;
  localStorage.setItem(STORAGE_KEY, token);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Drop the current token and mint a fresh anonymous one (on logout). */
export function resetOwnerToken(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, generateToken());
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
