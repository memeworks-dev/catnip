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
