"use client";
import { useTier } from "@/lib/useTier";

/**
 * Tool-page subtitle that swaps its copy for Pro owners. While the tier is
 * still loading we render the free copy so logged-out / anonymous visitors
 * (the common case) see no flash. Pro owners get a warmer, limit-free line.
 */
export function ProAwareSubtitle({
  free,
  pro,
}: {
  free: React.ReactNode;
  pro: React.ReactNode;
}) {
  const { isPro } = useTier();
  return <p className="mt-1 text-[13.5px] text-t2">{isPro ? pro : free}</p>;
}
