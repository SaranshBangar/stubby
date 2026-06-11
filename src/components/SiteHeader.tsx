"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

// Wordmark: orange "stub" + foreground "by", monospace — the design's logo.
function Wordmark() {
  return (
    <span className="font-mono text-[15px] font-medium tracking-tight">
      <span className="text-brand">stub</span>
      <span className="text-t1">by</span>
    </span>
  );
}

const TABS = [
  { href: "/mock", label: "Mock Builder" },
  { href: "/monitor", label: "Uptime Monitors" },
  { href: "/webhook", label: "Webhooks" },
];

/**
 * Single header for the whole app. `variant="landing"` shows marketing CTAs;
 * `variant="tool"` shows the tab bar with an active underline + plan strip.
 * An orange hairline sits above the nav on every page.
 */
export function SiteHeader({
  variant = "landing",
}: {
  variant?: "landing" | "tool";
}) {
  const pathname = usePathname();

  return (
    <>
      <div className="h-0.5 w-full shrink-0 bg-brand" />
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        {variant === "tool" ? (
          <div className="flex h-[50px] items-stretch px-6">
            <Link href="/" className="mr-7 flex items-center">
              <Wordmark />
            </Link>
            <div className="flex flex-1 items-stretch gap-0.5">
              {TABS.map(({ href, label }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`-mb-px flex items-center border-b-2 px-3.5 text-[13.5px] transition-colors ${
                      active
                        ? "border-brand font-medium text-t1"
                        : "border-transparent text-t2 hover:text-t1"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs text-t3">free plan</span>
              <Button asChild size="sm">
                <Link href="/#pricing">Go Pro</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex h-[52px] items-center justify-between px-6">
            <Link href="/">
              <Wordmark />
            </Link>
            <nav className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/mock">Mock Builder</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/monitor">Monitors</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/mock">Open free tool</Link>
              </Button>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
