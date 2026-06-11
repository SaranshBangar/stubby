"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { writeOwnerToken, resetOwnerToken } from "@/lib/useOwnerToken";

// Mirror of the server's PublicUser (lib/auth.ts).
export interface AuthUser {
  id: string;
  email: string;
  owner_token: string;
  has_password: boolean;
  has_google: boolean;
}

// Broadcast so every mounted useAuth (header + page) refreshes together.
const AUTH_EVENT = "stubby:auth-changed";
function announce() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EVENT));
}

/**
 * Client auth state on top of the owner_token bridge. On load (and whenever
 * auth changes) we read /api/auth/me; if a user is present we adopt their
 * canonical owner_token into localStorage so the tools load that account's
 * resources. login/register do the same with the response; logout reverts the
 * device to a fresh anonymous identity.
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await apiFetch<{ user: AuthUser | null }>("/api/auth/me");
      setUser(user);
      if (user) writeOwnerToken(user.owner_token);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(AUTH_EVENT, onChange);
    return () => window.removeEventListener(AUTH_EVENT, onChange);
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    writeOwnerToken(user.owner_token);
    setUser(user);
    announce();
    return user;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    writeOwnerToken(user.owner_token);
    setUser(user);
    announce();
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      resetOwnerToken();
      setUser(null);
      announce();
    }
  }, []);

  return { user, loading, login, register, logout, refresh };
}
