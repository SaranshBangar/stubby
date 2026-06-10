# Stubby — setup & deployment

Mock APIs and monitor uptime. No signup, no login. Next.js (App Router) on
**Cloudflare Workers** via OpenNext, with **D1** for storage, **Resend** for
email alerts, **Stripe** for the Pro tier, and a single Cron Trigger driving all
monitors.

This README is the only doc you need: it explains **every environment variable —
where to get it** — and the **deploy** steps end to end.

---

## 1. Prerequisites

- **Node 20+**
- A **Cloudflare** account → `npx wrangler login`
- A **Resend** account (email alerts)
- A **Stripe** account (Pro upgrades)

```bash
npm install
```

---

## 2. Environment variables — where each one comes from

Copy the template, then fill it in:

```bash
cp .env.example .dev.vars
```

> Local dev secrets live in **`.dev.vars`** (read by Wrangler/OpenNext), **not**
> `.env`. In production each secret is set with `wrangler secret put` (below).
> `APP_URL` is the one non-secret — set it in `wrangler.toml` under `[vars]`.

| Variable | Where to get it | Notes |
| --- | --- | --- |
| `APP_URL` | — | Public base URL of the app. `http://localhost:3000` for dev; your real domain in prod. Used in generated mock URLs and Stripe redirects. |
| `RESEND_API_KEY` | [resend.com/api-keys](https://resend.com/api-keys) → **Create API Key** | Starts with `re_`. |
| `ALERT_FROM_EMAIL` | A domain you verified in Resend → [resend.com/domains](https://resend.com/domains) | The "from" address on alert emails, e.g. `alerts@yourdomain.com`. Must be on a verified domain. |
| `STRIPE_SECRET_KEY` | [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) (use **test** keys while developing) | Starts with `sk_test_` / `sk_live_`. |
| `STRIPE_PRICE_ID` | Stripe Dashboard → **Products** → create a recurring ~$7/mo price → copy its **Price ID** | Starts with `price_`. |
| `STRIPE_WEBHOOK_SECRET` | From `stripe listen` (dev) or the Dashboard webhook endpoint (prod) | Starts with `whsec_`. See steps 5 & 7. |

### Optional tuning (defaults in `src/config/limits.ts`)

All optional — only set to override the free/pro defaults:

`FREE_MAX_MOCKS`, `FREE_MAX_MONITORS`, `FREE_MIN_INTERVAL_MINUTES`,
`FREE_EXPIRY_DAYS`, `FREE_CHECKS_HISTORY_LIMIT`, `PRO_MAX_MOCKS`,
`PRO_MAX_MONITORS`, `PRO_MIN_INTERVAL_MINUTES`, `CHECKS_HISTORY_LIMIT`,
`CRON_CONCURRENCY`, `PING_TIMEOUT_MS`.

---

## 3. Create the database (D1)

```bash
npx wrangler d1 create stubby-db
```

Copy the returned `database_id` into `wrangler.toml` under `[[d1_databases]]`.

Apply migrations:

```bash
npm run db:migrate:local     # local D1 (for dev)
npm run db:migrate:remote    # production D1 (before first deploy)
```

---

## 4. Run locally

```bash
npm run dev        # fast Next dev loop (D1 via OpenNext proxy)
npm run preview    # full Workers runtime — exercises the cron + webhook
```

Use `npm run dev` day to day. Use `npm run preview` to test the real Worker
(Stripe webhook and the scheduled monitor handler).

---

## 5. Test Stripe + cron locally (optional)

```bash
# Forward Stripe webhooks to your local Worker:
stripe listen --forward-to localhost:8787/api/stripe/webhook
#   → copy the printed whsec_… into STRIPE_WEBHOOK_SECRET in .dev.vars

# Fire one tick of the monitor cron (with `npm run preview` running):
curl "http://localhost:8787/cdn-cgi/handler/scheduled"
```

Pay with test card `4242 4242 4242 4242` (any future expiry / CVC).

---

## 6. Deploy to Cloudflare

```bash
# 1. Migrations against the remote DB (if not already done):
npm run db:migrate:remote

# 2. Set production secrets (do NOT put these in wrangler.toml):
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ALERT_FROM_EMAIL
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_PRICE_ID
npx wrangler secret put STRIPE_WEBHOOK_SECRET
#   → also set APP_URL to your real domain in wrangler.toml [vars]

# 3. Build with OpenNext and ship:
npm run deploy
```

The Cron Trigger (`* * * * *`) ships automatically from `wrangler.toml` — one
trigger pings every due monitor each minute.

---

## 7. Wire up the production Stripe webhook

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. URL: `https://<your-domain>/api/stripe/webhook`.
3. Subscribe to `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
4. Copy the endpoint's **signing secret** (`whsec_…`) and set it:
   `npx wrangler secret put STRIPE_WEBHOOK_SECRET`.

Done. The same anonymous browser token that paid is now Pro — nothing to log
into.
