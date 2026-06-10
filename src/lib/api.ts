"use client";
import { readOwnerToken } from "@/lib/useOwnerToken";

/**
 * Thin fetch wrapper that always attaches the owner token header. All
 * client-side calls to /api/* go through this so identity is consistent.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = readOwnerToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-owner-token": token } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `Request failed (${res.status})`);
  }
  return data;
}
