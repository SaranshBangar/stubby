import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { LandingDemo } from "@/components/LandingDemo";
import { UpgradeButton } from "@/components/UpgradeButton";
import { FaqAccordion } from "@/components/FaqAccordion";
import { Button } from "@/components/ui/button";
import { getLimits } from "@/config/limits";

export const metadata: Metadata = {
  title: "Stubby - Mock APIs, monitor uptime, inspect webhooks, track SSL",
  description:
    "Four developer tools in one no-signup tab: mock JSON endpoints, uptime monitors, a webhook inspector, and SSL tracking. Open it and use it - no account required.",
  alternates: { canonical: "/" },
};

const free = getLimits("free");
const pro = getLimits("pro");

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="landing" />

      <main>
        {/* ── Hero ── */}
        <section className="hero-bg px-6 pb-12 pt-16 text-center">
          <div className="mx-auto max-w-[1160px]">
            <div className="mb-7 inline-flex items-center gap-2 whitespace-nowrap rounded-[2px] border border-b1 bg-background px-3 py-[5px] font-mono text-xs text-t3">
              <span className="text-brand">$</span> stubby --no-signup
            </div>

            <h1 className="mx-auto max-w-[900px] text-balance text-[clamp(34px,5vw,60px)] font-semibold leading-[1.08] tracking-[-0.025em] text-t1">
              Mock APIs, monitor uptime, inspect webhooks, and track SSL
              <span className="text-brand">.</span>
              <br />
              One tool, no signup<span className="text-brand">.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-[600px] text-[clamp(15px,1.5vw,18px)] leading-relaxed text-t2">
              Open it and use it - no account required. Everything runs the
              moment the page loads.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/mock">Start building - no signup</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <a href="#features">See how it works</a>
              </Button>
            </div>
            <div className="mt-3.5 font-mono text-xs text-t3">
              an account is optional - only for syncing across devices
            </div>

            <div className="mt-[52px] text-left">
              <div className="mb-3.5 text-center font-mono text-[11px] tracking-[0.06em] text-t3">
                SEE THE TOOLS, LIVE
              </div>
              <LandingDemo />
            </div>
          </div>
        </section>

        {/* ── Features 2×2 ── */}
        <section
          id="features"
          className="mx-auto max-w-[1160px] scroll-mt-16 px-6 py-16"
        >
          <div className="mb-8 flex items-baseline gap-4">
            <h2 className="text-[clamp(22px,3vw,32px)] font-semibold tracking-[-0.02em] text-t1">
              Five tools. One tab.
            </h2>
            <span className="font-mono text-xs text-t3">
              nothing else to install
            </span>
          </div>
          <div className="grid gap-px overflow-hidden rounded-md border border-b1 bg-b1 sm:grid-cols-2">
            <FeatureCard
              href="/mock"
              icon="mock"
              n="01"
              title="Mock Endpoints"
              desc="Paste a JSON body, get a stable public URL in seconds. Set the status code, headers, and an optional delay. No auth headers required."
              span
            >
              <MethodBadge method="POST" />
              <code className="font-mono text-xs text-brand">
                stub.by/m/r4nd0m
              </code>
              <span className="ml-auto font-mono text-[11px] text-t3">
                201 Created
              </span>
            </FeatureCard>

            <FeatureCard
              href="/monitor"
              icon="monitor"
              n="02"
              title="Uptime &amp; SSL Monitoring"
              desc="Ping any URL on your schedule and track its TLS cert. Get alerted on downtime and at 30 / 14 / 7 days before expiry."
            >
              <Pill up />
              <code className="flex-1 truncate font-mono text-xs text-t2">
                api.myapp.com
              </code>
              <span className="inline-flex items-center gap-1 rounded-[2px] border border-success/25 bg-success/10 px-[7px] py-[2px] font-mono text-[11px] font-medium text-success">
                SSL 84d
              </span>
            </FeatureCard>

            <FeatureCard
              href="/webhook"
              icon="webhook"
              n="03"
              title="Webhook Inspector"
              desc="Capture and inspect incoming HTTP requests in real time."
            >
              <MethodBadge method="POST" />
              <code className="font-mono text-xs text-t1">/hook/stripe</code>
              <span className="ml-auto font-mono text-[11px] text-t3">
                1.2 kB
              </span>
            </FeatureCard>

            <FeatureCard
              href="/statuspage"
              icon="status"
              n="04"
              title="Status Pages"
              desc="Publish a public uptime page for your services."
            >
              <Pill up />
              <code className="flex-1 truncate font-mono text-xs text-t2">
                /status/acme
              </code>
              <span className="font-mono text-[11px] text-success">
                99.9%
              </span>
            </FeatureCard>

            <FeatureCard
              href="/alerts"
              icon="alerts"
              n="05"
              title="Alert Channels"
              desc="Email, Slack, Discord, and custom webhook notifications."
            >
              <span className="rounded-[2px] bg-s3 px-[7px] py-[2px] font-mono text-[11px] text-t2">
                Email
              </span>
              <span className="rounded-[2px] bg-s3 px-[7px] py-[2px] font-mono text-[11px] text-t2">
                Slack
              </span>
              <span className="rounded-[2px] bg-s3 px-[7px] py-[2px] font-mono text-[11px] text-t2">
                Discord
              </span>
              <span className="rounded-[2px] bg-s3 px-[7px] py-[2px] font-mono text-[11px] text-t2">
                Webhook
              </span>
            </FeatureCard>
          </div>
        </section>

        {/* ── Social proof ── */}
        <section className="border-y border-b1 bg-s1 px-6 py-12">
          <div className="mx-auto flex max-w-[1160px] flex-col items-center gap-8">
            <div className="text-center font-mono text-[clamp(15px,2vw,19px)] tracking-[-0.01em] text-t1">
              No account. No extension. No ads.{" "}
              <span className="text-brand">Just the tool.</span>
            </div>
            <div className="grid w-full max-w-[680px] grid-cols-2 gap-px overflow-hidden rounded-md border border-b1 bg-b1 sm:grid-cols-4">
              {[
                { n: "5", label: "tools" },
                { n: "1", label: "cron job" },
                { n: "0", label: "logins required" },
                { n: "∞", label: "free forever tier" },
              ].map((s) => (
                <div key={s.label} className="bg-background px-4 py-5 text-center">
                  <div className="font-mono text-[30px] font-semibold leading-none tracking-[-0.02em] text-brand">
                    {s.n}
                  </div>
                  <div className="mt-2 font-mono text-xs tracking-[0.04em] text-t2">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="mx-auto max-w-[1160px] px-6 py-16">
          <div className="mb-12 text-center">
            <h2 className="text-[clamp(24px,3vw,36px)] font-semibold tracking-[-0.02em] text-t1">
              Simple pricing.
            </h2>
            <p className="mt-2.5 text-[15px] text-t2">
              The free tier is genuinely useful. Upgrade only when you outgrow
              it.
            </p>
          </div>
          <div className="mx-auto grid max-w-[760px] gap-4 sm:grid-cols-2">
            <PlanCard name="Free" price="$0" sub="forever, no card">
              <PlanFeatures
                items={[
                  "All four tools, no signup",
                  `${free.maxMocks} mock endpoints`,
                  `${free.maxMonitors} uptime + SSL monitor`,
                  `${free.minIntervalMinutes}-minute check interval`,
                  "Email alerts",
                  `Webhook inspector - ${free.webhookRequestsPerEndpoint} stored requests`,
                  "Public status page",
                  `Mock URLs live ${free.expiryDays} days`,
                ]}
              />
              <Button asChild variant="secondary" className="w-full">
                <Link href="/mock">Start for free</Link>
              </Button>
            </PlanCard>

            <PlanCard name="Pro" price="$7" sub="per month" recommended>
              <PlanFeatures
                items={[
                  "Persistent resources - never expire",
                  `Up to ${pro.maxMonitors} monitors with SSL tracking`,
                  `${pro.minIntervalMinutes}-minute check intervals`,
                  "Slack, Discord & multi-channel alerts",
                  "Custom response headers",
                  `${pro.webhookRequestsPerEndpoint} webhook requests per endpoint`,
                  "Custom status page - no Stubby branding",
                ]}
              />
              <UpgradeButton className="w-full">Get Pro</UpgradeButton>
            </PlanCard>
          </div>
          <p className="mt-6 text-center font-mono text-[12.5px] text-t3">
            No asterisks. No usage traps. Cancel any time.
          </p>
        </section>

        {/* ── Sync callout ── */}
        <section className="mx-auto max-w-[760px] px-6 pb-4">
          <div className="flex flex-wrap items-center gap-7 rounded-md border border-b1 bg-s1 px-8 py-7">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-b1 bg-s2 text-t2">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 7a8 8 0 0 1 13-2l2 2" />
                <path d="M20 17a8 8 0 0 1-13 2l-2-2" />
                <path d="M19 4v3h-3" />
                <path d="M5 20v-3h3" />
              </svg>
            </div>
            <div className="min-w-[240px] flex-1">
              <h3 className="mb-1.5 text-[17px] font-semibold tracking-[-0.01em] text-t1">
                Want to sync across devices?
              </h3>
              <p className="text-sm leading-relaxed text-t2">
                Everything works without an account. Create one only if you want
                your mocks, monitors, and webhooks available on multiple
                devices.
              </p>
            </div>
            <Button asChild variant="secondary" className="shrink-0">
              <Link href="/account">Create a free account</Link>
            </Button>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="mx-auto max-w-[760px] px-6 pb-16 pt-12">
          <h2 className="mb-7 text-[22px] font-semibold tracking-[-0.02em] text-t1">
            FAQ
          </h2>
          <FaqAccordion
            items={[
              {
                q: "Do I need to sign up?",
                a: "No. Every tool - mocks, monitors, webhook inspector, SSL tracking - works the instant the page loads, with no account, no email, and no verification step. An account exists only if you want to sync your work across devices.",
              },
              {
                q: "What happens to my data without an account?",
                a: "Your mocks, monitors, and captured webhook requests are tied to your browser via an anonymous token. They persist on this device and stay live according to your plan's limits. Creating an account simply mirrors that same data to the cloud so it follows you to other devices.",
              },
              {
                q: "What is the difference between Free and Pro?",
                a: `Free gives you all four tools with generous limits, ${free.minIntervalMinutes}-minute checks, email alerts, and a public status page. Pro makes your resources persistent, raises the monitor limit to ${pro.maxMonitors}, drops checks to ${pro.minIntervalMinutes} minute, and adds Slack / Discord / multi-channel alerts, custom headers, and an unbranded status page.`,
              },
              {
                q: "How does the webhook inspector work?",
                a: "You create an endpoint and get a unique stub.by/w/… URL. Point any service at it and Stubby captures every incoming request - method, headers, query params, and body - so you can inspect them in real time and copy a ready-made curl command for each one.",
              },
              {
                q: "Will my mock URLs stay alive?",
                a: `On Free, mock URLs live for ${free.expiryDays} days after their last use. On Pro, they're permanent - bookmark them, hardcode them in tests, share them with your team. They never expire while your subscription is active.`,
              },
              {
                q: "How does SSL monitoring work?",
                a: "Enable SSL tracking on any uptime monitor and Stubby checks the certificate on every ping. You get the days remaining, expiry date, issuer, and chain validity - plus automatic alerts at 30, 14, and 7 days before expiry.",
              },
            ]}
          />
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-b1 px-6 py-7">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-start justify-between gap-5">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-sm">
              <span className="text-brand">stub</span>
              <span className="text-t1">by</span>
            </span>
            <span className="max-w-[280px] font-mono text-xs leading-relaxed text-t3">
              Four developer tools, no signup. Built for developers with other
              things to do.
            </span>
            <span className="mt-1 font-mono text-[11px] text-t3">
              Powered by Cloudflare Workers · © 2026
            </span>
          </div>
          <nav className="flex flex-wrap gap-[22px] font-mono text-[12.5px] text-t2">
            <Link href="/mock" className="hover:text-brand">
              /mock
            </Link>
            <Link href="/monitor" className="hover:text-brand">
              /monitor
            </Link>
            <Link href="/webhook" className="hover:text-brand">
              /webhook
            </Link>
            <Link href="/statuspage" className="hover:text-brand">
              /status
            </Link>
            <Link href="/alerts" className="hover:text-brand">
              /alerts
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* ── building blocks ─────────────────────────────────────── */

type IconKind = "mock" | "monitor" | "webhook" | "status" | "alerts";

function ToolIcon({ kind }: { kind: IconKind }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (kind === "mock")
    return (
      <svg {...common}>
        <path d="M8 5l-4 7 4 7M16 5l4 7-4 7" />
        <path d="M13 4l-2 16" opacity="0.5" />
      </svg>
    );
  if (kind === "monitor")
    return (
      <svg {...common}>
        <path d="M2 12h4l2-6 4 12 2.5-7 1.5 3h6" />
      </svg>
    );
  if (kind === "webhook")
    return (
      <svg {...common}>
        <path d="M3 7v3a2 2 0 0 0 2 2h11" />
        <path d="M16 8l4 4-4 4" />
        <circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    );
  if (kind === "status")
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18" />
        <path d="M7 14h3l1.5-3 2 5 1.5-2h2" />
      </svg>
    );
  // alerts (bell)
  return (
    <svg {...common}>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function FeatureCard({
  href,
  icon,
  n,
  title,
  desc,
  span,
  children,
}: {
  href: string;
  icon: IconKind;
  n: string;
  title: string;
  desc: string;
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col gap-3.5 bg-s1 p-7 transition-colors hover:bg-s2 ${
        span ? "sm:col-span-2" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-sm bg-brand-dim text-brand">
          <ToolIcon kind={icon} />
        </div>
        <div>
          <div className="font-mono text-[10.5px] tracking-[0.08em] text-t3">
            {n}
          </div>
          <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-t1">
            {title}
          </h3>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-t2">{desc}</p>
      <div className="mt-auto flex items-center gap-2 rounded-sm border border-b1 bg-s2 px-3 py-[11px]">
        {children}
      </div>
    </Link>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-success/15 text-success",
    POST: "bg-blue-400/15 text-blue-400",
    PUT: "bg-warning/15 text-warning",
    PATCH: "bg-purple-400/15 text-purple-400",
    DELETE: "bg-destructive/15 text-destructive",
  };
  const m = method.toUpperCase();
  return (
    <span
      className={`inline-flex min-w-[52px] items-center justify-center rounded-[2px] px-[7px] py-[2px] font-mono text-[11px] font-medium tracking-wider ${
        colors[m] ?? colors.GET
      }`}
    >
      {m}
    </span>
  );
}

function Pill({ up }: { up: boolean }) {
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

function MiniSpark() {
  const data = [145, 138, 156, 142, 139, 148, 142, 135];
  const w = 50;
  const h = 16;
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (v / max) * (h - 2) - 2;
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
        className="stroke-success"
      />
    </svg>
  );
}

function PlanCard({
  name,
  price,
  sub,
  recommended,
  children,
}: {
  name: string;
  price: string;
  sub: string;
  recommended?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex flex-col gap-5 rounded-md bg-s1 p-7 ${
        recommended ? "border border-t-2 border-brand" : "border border-b1"
      }`}
    >
      {recommended && (
        <div className="absolute right-4 top-4 rounded-[2px] bg-brand-dim px-2 py-[3px] font-mono text-[10px] tracking-wider text-brand">
          RECOMMENDED
        </div>
      )}
      <div>
        <div className="mb-2 font-mono text-[13px] text-t2">{name}</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-t1">
            {price}
          </span>
          <span className="font-mono text-[13px] text-t3">{sub}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

function PlanFeatures({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-1 flex-col gap-2.5">
      {items.map((f) => (
        <li key={f} className="flex items-start gap-2 text-[13.5px] text-t2">
          <span className="mt-px shrink-0 text-brand">✓</span> {f}
        </li>
      ))}
    </ul>
  );
}
