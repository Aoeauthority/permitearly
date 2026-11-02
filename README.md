# PermitEarly

> Daily permit alerts for Orlando contractors. Get there first.

## Stack
- **Next.js 14** (App Router) — API routes + frontend placeholder
- **Supabase** — Postgres + Edge Functions + Row-Level Security
- **Stripe** — $99/month subscriptions with 3-day free trial
- **Resend** — Transactional email digests
- **Vercel** — Deployment target

---

## Project Structure

```
permitearly/
├── app/
│   ├── api/
│   │   ├── health/          GET  → {"status":"OK"}
│   │   ├── signup/          POST → create contractor + Stripe checkout
│   │   ├── stripe-webhook/  POST → handle Stripe events
│   │   ├── permits/         GET  → query permits by trade + zip
│   │   ├── unsubscribe/     POST/GET → cancel subscription
│   │   └── trigger-pull/    POST → manually trigger edge function (dev)
│   ├── page.tsx             Landing page placeholder
│   └── success/             Post-checkout success page
├── lib/
│   └── supabase.ts          Supabase service client helper
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   ├── functions/
│   │   ├── pull-permits/    Cron job: fetch + tag + upsert permits, send digests
│   │   └── send-digest/     Send HTML email via Resend
│   └── config.toml
└── .env.local.example
```

---

## Setup

### 1. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all values.

```bash
cp .env.local.example .env.local
```

Required:
| Variable | Source |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as SUPABASE_URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → signing secret |
| `STRIPE_PRICE_ID` | See "Create Stripe Price" below |
| `RESEND_API_KEY` | resend.com → API Keys |
| `FROM_EMAIL` | `noreply@permitearly.com` (verify domain in Resend) |
| `TRIGGER_SECRET` | Any random string (protects `/api/trigger-pull`) |
| `NEXT_PUBLIC_APP_URL` | `https://permitearly.com` (or your Vercel URL) |

### 2. Create Stripe Price

```bash
stripe prices create \
  --unit-amount 9900 \
  --currency usd \
  --recurring interval=month \
  --product-data name="PermitEarly Monthly"
```

Copy the `price_...` ID into `STRIPE_PRICE_ID`.

### 3. Run Supabase Migration

```bash
# With Supabase CLI:
supabase db push

# Or paste supabase/migrations/001_initial_schema.sql into
# Supabase Dashboard → SQL Editor → Run
```

### 4. Deploy Edge Functions

```bash
supabase functions deploy pull-permits
supabase functions deploy send-digest
```

Set environment variables for the edge functions:

```bash
supabase secrets set \
  SUPABASE_URL=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  RESEND_API_KEY=... \
  FROM_EMAIL=noreply@permitearly.com \
  NEXT_PUBLIC_APP_URL=https://permitearly.com
```

### 5. Schedule pull-permits

In Supabase Dashboard → Edge Functions → pull-permits → Schedule:

```
Cron: 0 11 * * *   (7:00 AM ET = 11:00 AM UTC)
```

### 6. Configure Stripe Webhook

In Stripe Dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://permitearly.com/api/stripe-webhook`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

### 7. Install & Run Locally

```bash
npm install
npm run dev
```

---

## API Reference

### POST /api/signup

Create a contractor and start the Stripe checkout flow.

```json
{
  "email": "contractor@example.com",
  "company_name": "Ace Roofing LLC",
  "trade": "roofing",
  "zip_codes": ["32801", "32803", "32805"]
}
```

Returns: `{ "checkout_url": "https://checkout.stripe.com/..." }`

---

### GET /api/permits?trade=roofing&zip=32801,32803

Returns permits from the last 7 days.

Headers required:
- `x-contractor-email: contractor@example.com`
- `x-stripe-customer-id: cus_...`

---

### POST /api/unsubscribe

```json
{ "email": "contractor@example.com" }
```

Also works as a GET with `?email=...` for one-click email links.

---

### POST /api/trigger-pull

Manually triggers the pull-permits edge function (for testing).

Headers:
- `x-trigger-secret: <your TRIGGER_SECRET>`

---

### GET /api/health

Returns `{ "status": "OK", "ts": "..." }`.

---

## Trades Supported

| Trade Key | Matches |
|---|---|
| `fence` | pool, fence, fencing, enclosure |
| `pool` | pool, swimming |
| `landscaping` | landscap, irrigation, sprinkler, sod |
| `gutters` | gutter, downspout, fascia |
| `hurricane_shutters` | shutter, impact window, hurricane, storm panel |
| `solar` | solar, photovoltaic, PV |
| `hvac` | HVAC, air condition, AC, mechanical, ductwork |
| `pest_control` | termite, pest, treatment, fumigation |
| `roofing` | roof, shingle, tile roof |
| `electrical` | application_type contains "Electrical" |
| `plumbing` | application_type contains "Plumbing" |
| `new_construction` | new construction, new home, new single family |

---

## Data Source

City of Orlando Open Data — Socrata SODA API  
`https://data.cityoforlando.net/resource/ryhf-m453.json`
