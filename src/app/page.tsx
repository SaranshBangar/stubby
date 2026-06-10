import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { InlineDemo } from "@/components/InlineDemo";
import { UpgradeButton } from "@/components/UpgradeButton";
import { FaqAccordion } from "@/components/FaqAccordion";
import { Button } from "@/components/ui/button";
import { getLimits } from "@/config/limits";

export const metadata: Metadata = {
  title: "Stubby — Mock endpoints. Monitor uptime.",
  description:
    "Paste JSON, get a stable URL. Enter any URL, get emailed if it goes down. No account, no extension, no noise.",
  alternates: { canonical: "/" },
};

const free = getLimits("free");
const pro = getLimits("pro");

const NO_LIST = ["No login", "No extension", "No ads"];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="landing" />

      <main>
        {/* ── Hero ── */}
        <section className="mx-auto max-w-[1160px] px-6 pb-12 pt-20 text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-[2px] border border-b1 px-3 py-[5px] font-mono text-xs text-t3">
            <span className="text-brand">$</span> stubby --no-signup
          </div>

          <h1 className="mx-auto text-balance text-[clamp(38px,5.5vw,68px)] font-semibold leading-[1.05] tracking-tight text-t1">
            Mock endpoints.
            <br />
            Monitor uptime.
          </h1>

          <p className="mx-auto mt-5 max-w-[560px] text-balance text-[clamp(15px,1.5vw,18px)] leading-relaxed text-t2">
            Paste JSON, get a stable URL. Enter any URL, get emailed if it goes
            down. No account, no extension, no noise.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Button asChild size="lg">
              <Link href="/mock">Open the tool →</Link>
            </Button>
            <span className="font-mono text-xs text-t3">
              free forever · no signup required
            </span>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-6">
            {NO_LIST.map((item) => (
              <div
                key={item}
                className="flex items-center gap-1.5 text-[13px] text-t3"
              >
                <span className="text-brand">✓</span> {item}
              </div>
            ))}
          </div>

          <div className="mt-14 text-left">
            <div className="mb-4 text-center font-mono text-[11px] tracking-wider text-t3">
              — LIVE DEMO —
            </div>
            <InlineDemo />
          </div>
        </section>

        {/* ── Feature cards ── */}
        <section className="mx-auto max-w-[1160px] px-6 py-12">
          <div className="mb-12 h-px bg-b1" />
          <div className="grid gap-px overflow-hidden rounded-md border border-b1 bg-b1 sm:grid-cols-2">
            <FeatureCard
              href="/mock"
              label="01 / MOCK ENDPOINTS"
              title="Paste JSON. Get a URL."
              desc="Configure status code, headers, response body, and an optional delay. Your endpoint is live in seconds and shareable with anyone — no auth headers required."
            >
              <div className="rounded-sm border border-b1 bg-s2 p-3 font-mono text-xs">
                <div className="mb-1.5 text-t3">POST /users → 201 Created</div>
                <div className="text-code">{`{ "id": 99, "status": "created" }`}</div>
                <div className="mt-2 rounded-[2px] border border-brand/20 bg-brand-dim px-2.5 py-1.5 text-[11px] text-brand">
                  stub.by/m/r4nd0m
                </div>
              </div>
            </FeatureCard>

            <FeatureCard
              href="/monitor"
              label="02 / UPTIME MONITORS"
              title="Enter a URL. Sleep easy."
              desc="We ping your URL on your schedule — every minute down to every hour. The moment it fails, you get an email. No dashboard login required to check status."
            >
              <div className="flex flex-col gap-2 rounded-sm border border-b1 bg-s2 p-3">
                {[
                  { url: "api.myapp.com/health", up: true, ms: "142ms" },
                  { url: "staging.myapp.com", up: false, ms: "—" },
                  { url: "cdn.myapp.com", up: true, ms: "28ms" },
                ].map((row) => (
                  <div key={row.url} className="flex items-center gap-2 text-xs">
                    <Pill up={row.up} />
                    <code className="flex-1 truncate font-mono text-[11.5px] text-t2">
                      {row.url}
                    </code>
                    <span className="font-mono text-[11px] text-t3">
                      {row.ms}
                    </span>
                  </div>
                ))}
              </div>
            </FeatureCard>
          </div>
        </section>

        {/* ── Why Stubby ── */}
        <section className="border-y border-b1 bg-s1 px-6 py-12">
          <div className="mx-auto max-w-[1160px]">
            <div className="mb-9 flex items-baseline gap-4">
              <h2 className="text-[clamp(22px,3vw,32px)] font-semibold tracking-tight text-t1">
                Why Stubby?
              </h2>
              <span className="font-mono text-xs text-t3">
                vs. the bloated alternatives
              </span>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Zero account",
                  detail:
                    'Open the tool, use it. No email verification, no "set up your workspace."',
                },
                {
                  label: "Permanent URLs",
                  detail: `Free URLs live for ${free.expiryDays} days. Pro URLs never expire — bookmark them, share them, hardcode them.`,
                },
                {
                  label: "Two things, both great",
                  detail:
                    "We don't do analytics, auth mocking, load testing, or 47 other features you'll never touch.",
                },
                {
                  label: "Loads in < 1 second",
                  detail:
                    "No megabyte JS bundle. No tracking scripts. No cookie banner. Just the tool.",
                },
              ].map((p) => (
                <div key={p.label} className="border-l-2 border-brand pl-4">
                  <div className="mb-1.5 text-[15px] font-semibold text-t1">
                    {p.label}
                  </div>
                  <div className="text-[13.5px] leading-relaxed text-t2">
                    {p.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section
          id="pricing"
          className="mx-auto max-w-[1160px] px-6 py-16"
        >
          <div className="mb-12 text-center">
            <h2 className="text-[clamp(24px,3vw,36px)] font-semibold tracking-tight text-t1">
              Simple pricing.
            </h2>
            <p className="mt-2.5 text-[15px] text-t2">
              Start free. Upgrade only if you need more.
            </p>
          </div>
          <div className="mx-auto grid max-w-[720px] gap-4 sm:grid-cols-2">
            {/* Free */}
            <PlanCard name="Free" price="$0" sub="forever, no credit card">
              <PlanFeatures
                items={[
                  `${free.maxMocks} mock endpoints`,
                  `${free.maxMonitors} uptime monitor`,
                  `${free.minIntervalMinutes}-minute check interval`,
                  `URLs expire after ${free.expiryDays} days`,
                  "application/json responses",
                ]}
              />
              <Button asChild variant="secondary" className="w-full">
                <Link href="/mock">Start for free</Link>
              </Button>
            </PlanCard>

            {/* Pro */}
            <PlanCard name="Pro" price="$7" sub="per month" recommended>
              <PlanFeatures
                items={[
                  `Up to ${pro.maxMocks} mock endpoints`,
                  `${pro.maxMonitors} uptime monitors`,
                  `${pro.minIntervalMinutes}-minute check intervals`,
                  "Permanent, never-expiring URLs",
                  "Custom response headers",
                  "Priority support",
                ]}
              />
              <UpgradeButton className="w-full">Get Pro</UpgradeButton>
            </PlanCard>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="mx-auto max-w-[720px] px-6 pb-16 pt-12">
          <h2 className="mb-7 text-[22px] font-semibold tracking-tight text-t1">
            FAQ
          </h2>
          <FaqAccordion
            items={[
              {
                q: "Do I need to create an account?",
                a: "No. Your identity is a random token stored in your browser and embedded in your resource URLs — no email, no password for the free tier. Open the page, create a mock or monitor, and you're done.",
              },
              {
                q: "How stable are the mock URLs?",
                a: `Free URLs expire after ${free.expiryDays} days. Pro URLs never expire — they survive browser refreshes and time itself. Both are available immediately with no warmup period.`,
              },
              {
                q: "How does uptime monitoring work?",
                a: "We send an HTTP request to your URL at the interval you choose. If we get a non-2xx response or a timeout, we email you immediately. Response times are logged for each check.",
              },
              {
                q: "Can I mock non-GET requests?",
                a: "Yes — your mock URL responds to GET, POST, PUT, PATCH and DELETE with the same stored response.",
              },
              {
                q: "Is there a cookie banner?",
                a: "No tracking cookies, so no banner. We use a single localStorage value as your anonymous identity — that's it.",
              },
            ]}
          />
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-b1 px-6 py-6">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-[13px]">
            <span className="text-brand">stub</span>
            <span className="text-t3">by</span>
            <span className="ml-3 text-[11px] text-t3">© 2026</span>
          </span>
          <nav className="flex gap-6 font-mono text-xs text-t3">
            <Link href="/monitor" className="hover:text-t1">
              Status
            </Link>
            <Link href="/#pricing" className="hover:text-t1">
              Pricing
            </Link>
            <Link href="/mock" className="hover:text-t1">
              Mock
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  href,
  label,
  title,
  desc,
  children,
}: {
  href: string;
  label: string;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group bg-s1 p-8 transition-colors hover:bg-s2"
    >
      <div className="mb-3 font-mono text-[11px] tracking-wider text-brand">
        {label}
      </div>
      <h3 className="mb-2.5 text-[22px] font-semibold tracking-tight text-t1">
        {title}
      </h3>
      <p className="mb-5 text-sm leading-relaxed text-t2">{desc}</p>
      {children}
      <div className="mt-5 text-[13px] font-medium text-brand">Try it →</div>
    </Link>
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
        recommended
          ? "border border-t-2 border-brand"
          : "border border-b1"
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
          <span className="text-[40px] font-semibold leading-none tracking-tight text-t1">
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
    <ul className="flex flex-col gap-2.5">
      {items.map((f) => (
        <li
          key={f}
          className="flex items-start gap-2 text-[13.5px] text-t2"
        >
          <span className="mt-px shrink-0 text-brand">✓</span> {f}
        </li>
      ))}
    </ul>
  );
}
