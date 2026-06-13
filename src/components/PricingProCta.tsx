"use client";
import { useTier } from "@/lib/useTier";
import { UpgradeButton } from "@/components/UpgradeButton";

/**
 * Pro plan call-to-action on the pricing section. Owners who already hold Pro
 * see a thank-you badge instead of another "Upgrade" button. Until the tier
 * resolves we show the upgrade button (the default for the common visitor).
 */
export function PricingProCta() {
  const { isPro } = useTier();

  if (isPro) {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-md border border-brand/30 bg-brand-dim px-3 py-2.5 text-center font-mono text-[13px] font-medium text-brand">
        <span aria-hidden>🧡</span> Thank you for subscribing :)
      </div>
    );
  }

  return <UpgradeButton className="w-full">Get Pro — ₹99 forever</UpgradeButton>;
}
