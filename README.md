# Catnip 🐈

Platform for building, hosting, and spreading interactive marketing toys. A
**MemeWorks** company. Working name: Catnip (`catnip.io`).

A "toy" is a free public AI experience a brand puts in front of strangers (open
a link, upload a photo, get a personalised meme, share it). The hard part isn't
generating a toy — it's everything after: **cost control, a virality loop, and
measurement**. Catnip is that layer.

> **This repo is a scaffold.** The architecture, data model, service wiring, and
> folder structure from [`claude.md`](./claude.md) are in place; **features are
> not built yet**. Most `/lib` functions are typed stubs that throw
> `NotImplementedError` with a TODO pointing at the relevant spec section.
> `claude.md` is the full production spec and the single source of truth.

---

## Stack

| Concern | Tool |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Postgres + Prisma 7 (pg driver adapter) |
| Auth | Clerk (dashboard only; toys are public) |
| Payments | Stripe |
| Generation | Google nano banana (Gemini) primary, fal.ai fallback — behind `generateImage()` |
| Moderation | Google Vision — behind `moderateImage()`, fail-closed |
| Jobs | Upstash QStash |
| Cache / rate limit | Upstash Redis (`@upstash/ratelimit`) |
| Storage | Cloudflare R2 (S3-compatible) |
| Analytics | PostHog |
| Email | Resend |
| Bots | Cloudflare Turnstile |
| Errors | Sentry |
| Hosting | Vercel (app, Cron, OG, wildcard + custom domains) |

Every provider sits behind a thin interface so it can be swapped. **Generation
and moderation must never call a provider SDK directly from a route** (hard rule
#2).

---

## Project structure

```
app/                         Next.js App Router
  page.tsx                   Marketing landing (catnip.io)
  dashboard/                 Owner dashboard (§4B) — Clerk-gated when built
  t/[slug]/                  Public toy route (§2, §4A) — multi-tenant render
  api/
    health/                  Liveness check (§12)
    webhooks/stripe/         Stripe webhook receiver (stub)
    jobs/generate/           QStash generation worker (stub)
proxy.ts                     Host-based routing for subdomains + custom domains (§2A; Next 16 proxy convention)

lib/                         The thin orchestration layer (our only real code)
  env.ts                     Typed, lazy env access (§15)
  errors.ts                  Domain errors → graceful states (§12)
  prisma.ts                  Prisma client singleton (pg adapter)
  logger.ts                  Structured logging w/ request id (§12)
  generation/                generateImage() + provider interface (nano banana, fal)
  moderation/                moderateImage()/moderateText() + provider (Google Vision), fail-closed
  metering/                  Spend cap (reserve→generate→reconcile), quota, kill switch, pricing (§7, §11)
  billing/                   Stripe client + credit ledger (§4, §11)
  analytics/                 PostHog server + browser clients, K-factor (§10)
  email/                     Resend client + senders (§12)
  redis.ts ratelimit.ts qstash.ts        Upstash clients
  storage/r2.ts              Cloudflare R2 (signed URLs)
  auth/clerk.ts              Clerk helpers + requireOwner() (§13)
  turnstile.ts sentry.ts domains.ts      Turnstile / Sentry / Vercel domains (§2A)

components/                  Shared UI (graceful-state.tsx, …)
jobs/                        Background work invoked by QStash / Vercel Cron
templates/                   Toy template specs — our IP
  meme-booth.md              First-pass meme-booth template (§16, §20)
  EXPERIENCE_GUIDE.md        Placeholder for the custom-experience builder (§16A)
  blocks/                    Placeholder block library (§16A)

prisma/
  schema.prisma             Full data model (§6)
  migrations/               SQL migrations
prisma.config.ts            Prisma 7 config (schema path, migrate datasource URL)
.env.example                Every variable from §15
```

`@/*` import alias maps to the repo root (e.g. `@/lib/prisma`).

---

## Getting started

### Prerequisites

- Node.js >= 20.12 (uses `process.loadEnvFile`)
- A PostgreSQL database (local, Neon, or Supabase)

### 1. Install

```bash
npm install
```

`postinstall` runs `prisma generate` (it doesn't touch the DB, so it's fine
before `DATABASE_URL` is set).

### 2. Configure env

```bash
cp .env.example .env
```

For local dev you only need `DATABASE_URL` to boot and migrate; the managed
services are read lazily and only required once you wire/use a feature. Example
local URL:

```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/catnip?schema=public
```

### 3. Migrate the database

```bash
npm run db:migrate      # prisma migrate dev — creates/applies migrations
```

### 4. Run

```bash
npm run dev             # http://localhost:3000
```

Health check: `GET http://localhost:3000/api/health`.

### Useful scripts

| Script | What |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:generate` | regenerate the Prisma client |
| `npm run db:deploy` | `prisma migrate deploy` (prod) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | drop + re-apply all migrations |

---

## Deploying to Vercel

The app builds without a database (the Prisma client is lazy), but every
data-backed page — the **dashboard** and the public toys — needs the schema
applied to your production Postgres. The build does this for you:

```
build = node scripts/migrate-deploy.mjs && next build
```

`migrate-deploy.mjs` runs `prisma migrate deploy` when `DATABASE_URL` (or
`DIRECT_URL`) is set, and skips cleanly when neither is — so a missing schema
can't silently 500 the dashboard. Required env to set in Vercel:

- `DATABASE_URL` — pooled runtime connection.
- `DIRECT_URL` — *optional*, the direct (non-pooled) connection. **Set this for
  Supabase** (the transaction pooler on `:6543` can't run migrations); migrations
  use it when present.
- Clerk keys (`CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) to protect
  the dashboard — set **both** or neither (one alone disables auth).

**Check it after deploy:** `GET /api/health/ready` reports whether the database is
reachable and the schema is migrated, e.g.
`{"ok":false,"checks":{"schema":"missing", …}}` means migrations didn't run.
`GET /api/health` is a dependency-free liveness probe.

---

## Custom domains (§2A)

An owner can serve a toy on their own domain (e.g. `meme.theirbrand.com`) instead
of (or alongside) `slug.catnip.io`. It reuses the multi-tenant render — a custom
domain is just another route into the same toy, never a separate deployment.

**How it works**

1. Owner enters a domain in the dashboard → it's added to the Vercel project via
   the Vercel Domains API and stored on the `Toy` with `domain_status = pending`
   plus the DNS record Vercel needs.
2. The dashboard shows the exact record to set (CNAME → `cname.vercel-dns.com`,
   or an A record for an apex) with copy buttons and a clear
   pending / verifying / verified / error state.
3. Verification runs on demand ("Check now") and on a Vercel Cron poll
   (`/api/cron/verify-domains`, hourly). On success Vercel auto-provisions SSL and
   `domain_status` flips to `verified`.
4. `proxy.ts` resolves the incoming `Host` header to a toy — for verified custom
   domains and `*.catnip.io` subdomains — and renders it identically (same
   metering, quota, moderation, share, analytics).

A domain maps to exactly one toy (unique + ownership-checked). Until it's
verified the toy keeps serving on its `catnip.io` slug, so the owner is never
blocked. Removing a domain detaches it from Vercel and clears the fields.

**Setup on Vercel**

- Point a wildcard `*.catnip.io` (and the apex) at the Catnip project so per-toy
  subdomains resolve (§2).
- Set `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID` (the Catnip project — `prj_…` or its
  name), and `VERCEL_TEAM_ID` if the project is under a team.
- Set `ROOT_DOMAIN` (defaults to `catnip.io`) — drives subdomain routing.
- Set `CRON_SECRET`; Vercel Cron sends it as `Authorization: Bearer <secret>` and
  the cron route rejects calls without it.

> The cron schedule in `vercel.json` is daily (`0 0 * * *`) so it works on Vercel
> **Hobby** (which caps crons at once per day). On **Pro** you can poll more
> often, e.g. `0 * * * *` (hourly). "Check now" verifies on demand regardless.

---

## Notes for the next phase

- **Spend cap is sacred** (§7, hard rule #1): implement reserve→generate→
  reconcile atomically in Redis, mirror to Postgres, and add the concurrency
  test that proves the cap can't be exceeded under load.
- **Moderation is fail-closed from day one** (§8): the `moderateImage()` wrapper
  already rejects on any provider error — keep it that way; never store images
  that appear to involve minors.
- **Money is a ledger** (§4): every spend/top-up writes a `CreditLedger` row;
  balance is derived; webhooks are idempotent via `WebhookEvent`.
- **Clerk + Sentry are intentionally not mounted yet** so the app boots with an
  empty `.env`. Add `ClerkProvider`/`clerkMiddleware` around the dashboard, and
  run the Sentry wizard (`npx @sentry/wizard@latest -i nextjs`) to add
  `instrumentation.ts` + `withSentryConfig`, when building those features.
- First real task per the spec: tighten `templates/meme-booth.md` (§20).
