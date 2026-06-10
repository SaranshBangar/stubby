"use client";
import type { CheckRow } from "@/lib/types";

/**
 * Cheap inline SVG history bar. Each recent check is a bar: green=ok,
 * red=fail; height ~ response time (capped). Oldest left, newest right.
 */
export function Sparkline({ checks }: { checks: CheckRow[] }) {
  if (checks.length === 0) {
    return <span className="text-xs text-muted-foreground">no checks yet</span>;
  }
  // checks come newest-first; render oldest->newest left-to-right.
  const ordered = [...checks].reverse();
  const maxRt = Math.max(100, ...ordered.map((c) => c.response_time_ms ?? 0));
  const W = 4;
  const GAP = 1;
  const H = 24;

  return (
    <svg
      width={ordered.length * (W + GAP)}
      height={H}
      role="img"
      aria-label={`Last ${ordered.length} checks`}
      className="overflow-visible"
    >
      {ordered.map((c, i) => {
        const ok = c.ok === 1;
        const h = c.response_time_ms
          ? Math.max(3, Math.round((c.response_time_ms / maxRt) * H))
          : H;
        return (
          <rect
            key={c.id}
            x={i * (W + GAP)}
            y={H - h}
            width={W}
            height={h}
            rx={1}
            className={ok ? "fill-success" : "fill-destructive"}
          >
            <title>
              {new Date(c.checked_at).toLocaleString()} —{" "}
              {c.status_code ?? "timeout"}
              {c.response_time_ms != null ? ` · ${c.response_time_ms}ms` : ""}
            </title>
          </rect>
        );
      })}
    </svg>
  );
}
