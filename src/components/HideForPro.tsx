"use client";
import { useTier } from "@/lib/useTier";

/**
 * Renders its children for everyone except confirmed Pro owners. Used to drop
 * "upgrade" marketing (RECOMMENDED / LIMITED TIME OFFER badges) from the Pro
 * plan card once the viewer already holds Pro. Free/anonymous viewers — the
 * common case while the tier resolves — keep seeing the badges.
 */
export function HideForPro({ children }: { children: React.ReactNode }) {
  const { isPro } = useTier();
  if (isPro) return null;
  return <>{children}</>;
}
