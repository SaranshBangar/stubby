"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Hero demo strip - a browser-framed panel that cycles through all four tools
 * (Mock → Monitor → Webhooks → SSL) every 3s, pausing on hover. Tabs let you
 * jump directly. Pure presentation: it shows what each tool produces, mirroring
 * the live product without hitting the API. Respects prefers-reduced-motion.
 */

const TOOLS = [
  { id: "mock", label: "Mock", path: "mock" },
  { id: "monitor", label: "Monitor", path: "monitor" },
  { id: "webhook", label: "Webhooks", path: "webhook" },
  { id: "ssl", label: "SSL", path: "monitor/api" },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

export function LandingDemo() {
  const [active, setActive] = useState<ToolId>("mock");
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  useEffect(() => {
    if (reduced.current || paused) return;
    const ids = TOOLS.map((t) => t.id);
    const timer = setInterval(() => {
      setActive((prev) => ids[(ids.indexOf(prev) + 1) % ids.length]);
    }, 3000);
    return () => clearInterval(timer);
  }, [paused]);

  const url = TOOLS.find((t) => t.id === active)!.path;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="overflow-hidden rounded-md border border-b1 bg-s1 text-left shadow-[0_24px_60px_-32px_rgba(0,0,0,0.55)]"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-[7px] border-b border-b1 bg-s2 px-3.5 py-2.5">
        <span className="h-[7px] w-[7px] rounded-full bg-[#ff5f57]" />
        <span className="h-[7px] w-[7px] rounded-full bg-[#febc2e]" />
        <span className="h-[7px] w-[7px] rounded-full bg-[#28c840]" />
        <div className="flex flex-1 justify-center">
          <div className="rounded-full border border-b1 bg-background px-3.5 py-[3px] font-mono text-[11px] text-t3">
            stubby.site/{url}
          </div>
        </div>
      </div>

      {/* Tool tabs */}
      <div role="tablist" className="flex border-b border-b1 bg-background">
        {TOOLS.map((t) => {
          const sel = active === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={sel}
              onClick={() => setActive(t.id)}
              className={`-mb-px flex-1 border-b-2 py-[9px] font-mono text-[11.5px] tracking-[0.05em] transition-colors ${
                sel
                  ? "border-brand font-medium text-t1"
                  : "border-transparent text-t2 hover:text-t1"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="min-h-[184px] p-[18px]">
        {active === "mock" && <DemoMock />}
        {active === "monitor" && <DemoMonitor />}
        {active === "webhook" && <DemoWebhook />}
        {active === "ssl" && <DemoSsl />}
      </div>
    </div>
  );
}

/* ── shared bits ─────────────────────────────────────────── */

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-success/15 text-success",
  POST: "bg-blue-400/15 text-blue-400",
  PUT: "bg-warning/15 text-warning",
  PATCH: "bg-purple-400/15 text-purple-400",
  DELETE: "bg-destructive/15 text-destructive",
};

function MethodBadge({ method }: { method: string }) {
  const m = method.toUpperCase();
  return (
    <span
      className={`inline-flex min-w-[52px] items-center justify-center rounded-[2px] px-[7px] py-[2px] font-mono text-[11px] font-medium tracking-wider ${
        METHOD_COLORS[m] ?? METHOD_COLORS.GET
      }`}
    >
      {m}
    </span>
  );
}

function StatusPill({ up }: { up: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[2px] px-2 py-[3px] font-mono text-[11px] font-medium tracking-wider ${
        up ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
      }`}
    >
      <span
        className={`h-[5px] w-[5px] rounded-full ${
          up ? "bg-success" : "bg-destructive"
        }`}
      />
      {up ? "UP" : "DOWN"}
    </span>
  );
}

function MiniSpark({ data }: { data: number[] }) {
  const w = 56;
  const h = 18;
  const max = Math.max(...data, 1);
  const down = data.some((v) => v === 0);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = v === 0 ? h : h - (v / max) * (h - 2) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="block shrink-0">
      <polyline
        points={pts}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={down ? "stroke-destructive" : "stroke-success"}
      />
    </svg>
  );
}

function SslBadge({ days }: { days: number }) {
  const tone =
    days <= 14
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : days <= 30
        ? "border-warning/25 bg-warning/10 text-warning"
        : "border-success/25 bg-success/10 text-success";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[2px] border px-[9px] py-[3px] font-mono text-[11.5px] font-medium ${tone}`}
    >
      <span className="text-[10px]">▣</span> SSL · {days}d
    </span>
  );
}

/* ── panels ──────────────────────────────────────────────── */

function DemoMock() {
  return (
    <div className="grid grid-cols-2 gap-3.5">
      <div className="flex flex-col gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-t3">
          Response body
        </div>
        <pre className="overflow-hidden rounded-sm border border-b1 bg-s2 px-3 py-[11px] font-mono text-xs leading-relaxed text-code">
          {`{
  "id": 42,
  "name": "Jane Doe",
  "role": "admin"
}`}
        </pre>
      </div>
      <div className="flex flex-col gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-t3">
          Your endpoint
        </div>
        <div className="flex items-center overflow-hidden rounded-sm border border-b2 bg-s2">
          <code className="flex-1 truncate px-2.5 py-2 font-mono text-xs text-brand">
            stub.by/m/r4nd0m
          </code>
          <span className="border-l border-b1 px-[11px] font-mono text-[11px] leading-[34px] text-t3">
            copy
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <MethodBadge method="POST" />
          <span className="font-mono text-[11.5px] text-t3">
            201 Created · no delay
          </span>
        </div>
        <div className="mt-auto flex items-center gap-1.5 font-mono text-[11px] text-success">
          <span className="pulse h-1.5 w-1.5 rounded-full bg-success" /> live ·
          expires in 7d
        </div>
      </div>
    </div>
  );
}

function DemoMonitor() {
  const rows = [
    {
      url: "api.myapp.com/health",
      up: true,
      ms: "142ms",
      spark: [145, 138, 156, 142, 139, 148, 142, 135],
    },
    {
      url: "staging.myapp.com",
      up: false,
      ms: "-",
      spark: [92, 88, 95, 91, 87, 0, 0, 0],
    },
    {
      url: "cdn.myapp.com",
      up: true,
      ms: "28ms",
      spark: [30, 28, 31, 27, 29, 28, 30, 28],
    },
  ];
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div
          key={r.url}
          className="flex items-center gap-2.5 rounded-sm border border-b1 bg-s2 px-[11px] py-2"
        >
          <StatusPill up={r.up} />
          <code className="flex-1 truncate font-mono text-xs text-t2">
            {r.url}
          </code>
          <span
            className={`font-mono text-[11.5px] ${
              r.up ? "text-t3" : "text-destructive"
            }`}
          >
            {r.ms}
          </span>
          <MiniSpark data={r.spark} />
        </div>
      ))}
    </div>
  );
}

function DemoWebhook() {
  const reqs = [
    { m: "POST", path: "/hook/stripe", t: "12:04:51", size: "1.2 kB" },
    { m: "POST", path: "/hook/github", t: "12:04:33", size: "847 B" },
    { m: "GET", path: "/hook/health", t: "12:03:58", size: "0 B" },
    { m: "DELETE", path: "/hook/cleanup", t: "12:01:10", size: "0 B" },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="mb-0.5 flex items-center gap-2">
        <code className="font-mono text-[11.5px] text-brand">
          stub.by/w/k7f3m9x2
        </code>
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-success">
          <span className="pulse h-1.5 w-1.5 rounded-full bg-success" /> listening
        </span>
      </div>
      {reqs.map((r, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 rounded-sm border border-b1 bg-s2 px-[11px] py-[7px]"
        >
          <MethodBadge method={r.m} />
          <code className="flex-1 font-mono text-xs text-t1">{r.path}</code>
          <span className="font-mono text-[11px] text-t3">{r.size}</span>
          <span className="font-mono text-[11px] text-t3">{r.t}</span>
        </div>
      ))}
    </div>
  );
}

function DemoSsl() {
  const tiles = [
    { label: "Days left", value: "84", color: "text-success" },
    { label: "Expires", value: "Sep 3", color: "text-t1" },
    { label: "Issuer", value: "Let's Encrypt", color: "text-t1" },
    { label: "Chain", value: "Valid", color: "text-success" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <code className="font-mono text-xs text-t2">api.myapp.com</code>
        <SslBadge days={84} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-sm border border-b1 bg-s2 px-[11px] py-2.5"
          >
            <div className="mb-[5px] truncate font-mono text-[9.5px] uppercase tracking-[0.06em] text-t3">
              {t.label}
            </div>
            <div
              className={`truncate font-mono text-[15px] font-semibold ${t.color}`}
            >
              {t.value}
            </div>
          </div>
        ))}
      </div>
      <div className="font-mono text-[11px] text-t3">
        alerts queued at 30 / 14 / 7 days before expiry
      </div>
    </div>
  );
}
