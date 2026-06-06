# Catnip — Production Build Spec

*Save this file as `AGENTS.md` in the repo root. Codex reads it on every task, so it is the single source of truth. This is the full production spec, not a demo. Read top to bottom before writing code. A MemeWorks company. Working name: Catnip, catnip.io.*

---

## 0. Read this first

You are building **Catnip**: a platform for building, hosting, and spreading interactive marketing toys. A "toy" is a free public AI experience a company puts in front of strangers to capture attention (open a link, upload a photo, get cooked into a personalised meme, share it, drive traffic back to the brand).

**The core insight:** the hard part is not generating a toy. Lots of tools can do that. The hard part is everything after, for a free public high-volume toy: cost control, a virality loop, and measurement. Catnip is the layer that turns a generated toy into something safe to put in front of the public and engineered to spread. That layer is the product.

**v1 is for technical builders** using a markdown template spec, but the platform itself must be production grade because the toys face the public at unpredictable volume. We are building for 100+ paying customers and toys that may go viral, not a demo.

**Build philosophy:** stitch best-in-class services, do not rebuild infrastructure. The only things we build are the thin orchestration layer, the toy template specs (our IP), and the dashboard. Everything else (auth, payments, storage, queues, moderation, rate limiting, analytics) is a managed service behind a clean interface.

---

## 1. Business context (drives technical decisions)

- **Cost model:** building a toy is near free. Hosting is cheap. **Generation is the only real ongoing cost.** A toy nobody uses costs us nothing. A successful toy pays us on every run. Our cost tracking must therefore be exact, because we make money on the margin between what a run costs us and what we charge.
- **Generation buffer:** we hold roughly $20k of Google nano banana (Gemini image) credits, the cushion for free launch credits.
- **Pricing:**
  - Platform access is sold separately from generation.
  - **Generation is billed at 2.5x model cost**, transparent, shown in the dashboard.
  - Launch: **$420 one-time lifetime platform access** (first 10 slots), includes a starting free-credit pool, then pay-per-run.
  - After 10 lifetime slots: **$49/mo** subscription for platform access.
  - First ~50 runs per toy are free (loss leader), then billable.
- **Non-negotiable brand promise: never a surprise bill.** Every toy has a hard spend cap that cannot be exceeded under any load. The dashboard always shows free runs remaining and live spend versus cap. This is the entire reason the product exists. Treat it as the most important engineering requirement in this document.

---

## 2. Architecture decisions (settled, build to these)

1. **Multi-tenant toys, not per-toy deploys.** Every toy is served dynamically from the single Catnip Next.js app, rendered from its config row in the database. A toy lives at `catnip.io/t/[slug]` and optionally at `[slug].catnip.io` via a wildcard subdomain. Publishing a toy writes a record and flips a status, it does not trigger a separate deployment. This is what scales cleanly to hundreds of toys. (Per-project Vercel deploys are reserved for future custom vibe-coded toys, out of scope for v1.)
2. **Platform hosting:** the Catnip app deploys to Vercel. Use Vercel for the app, Vercel Cron for scheduled jobs, and Vercel OG for share cards. Configure a wildcard domain (`*.catnip.io`) pointing at the app for per-toy subdomains.
3. **Async generation by default.** Generation runs as a durable background job so the public toy stays responsive under load and failures retry. The toy UI submits, then polls or subscribes for the result.
4. **Money is a ledger, not a number.** Credits are tracked in an append-only ledger table. The owner balance is derived from the ledger. This makes billing auditable and reconciliation correct.
5. **The spend cap is enforced with atomic reservations**, not a naive read-then-write, so concurrent requests cannot race past it.
6. **Custom domains are a v1 feature.** An owner can point their own domain (for example `meme.theirbrand.com`) at their toy via the Vercel Domains API plus host-based routing. See section 2A.

---

## 2A. Custom domains (how it works)

Owners can serve a toy on their own domain instead of `slug.catnip.io`. Build to this flow:

1. **Owner enters a domain** in the dashboard (for example `meme.theirbrand.com`).
2. **Catnip adds it to the Vercel project** via the Vercel Domains API and stores it on the Toy with `domain_status = pending`.
3. **Catnip shows the required DNS record** returned by Vercel (typically a CNAME to `cname.vercel-dns.com`, or A records for an apex domain). The owner sets this at their registrar.
4. **Catnip verifies** by polling the Vercel domain status (a Vercel Cron job or an on-demand "check now" button). On success, Vercel auto-provisions SSL and Catnip sets `domain_status = verified`.
5. **Host-based routing:** Next.js middleware reads the incoming `Host` header. If it matches a verified custom domain or a `*.catnip.io` subdomain, it resolves the Toy and renders it. The toy works identically on a custom domain: same metering, quota, moderation, share, and analytics.

Rules:
- A domain maps to exactly one toy; enforce uniqueness and ownership.
- Until `domain_status = verified`, the toy still serves on its `catnip.io` slug, so the owner is never blocked.
- Verification can fail or take time (DNS propagation). Surface a clear `pending`, `verifying`, `verified`, or `error` state with the exact DNS record and a retry, never a dead end.
- Removing a domain detaches it from the Vercel project and clears the fields.
- This reuses the multi-tenant model: a custom domain is just another route into the same dynamically rendered toy, not a separate deployment.

---

## 3. The four pillars (target shape; v1 ships the named slices)

1. **Building blocks** — library of toy template specs (markdown) plus a coding-agent workflow that generates or customises a toy. v1 ships ONE template (meme booth).
2. **Hosting** — multi-tenant, deploy to a link or embed, usage tracked out of the box.
3. **Virality loop** — auto dynamic share card per result, "made with Catnip" attribution and watermark, self-insert by default, analytics around share rate and K-factor.
4. **Metering and governance** — pay-per-run, hard spend caps, throttling, rate limiting, bot and abuse protection, content moderation.

v1 ships: one template, multi-tenant hosting, the full virality loop, and the full metering and governance layer (this is the differentiator, so it is built properly, not as a slice).

---

## 4. The product, concretely

The canonical first toy is a **Meme Booth**: open a link, upload a photo, get a personalised meme, see a watermarked share card, share it. The brand gets attribution and traffic back.

Two surfaces:

**A. The public toy** (strangers touch this)
- Landing, upload photo and/or enter name, bot check, generate, result, share card with watermark and brand attribution, share buttons.
- Enforces per-visitor quota before a soft wall.
- Every generation reserves against the toy spend cap first. If the cap is reached, a graceful branded "taking a break" state, never an error, never an overspend.
- Works embedded in a third party page (iframe or script).

**B. The owner dashboard** (the paying customer touches this)
- Create a toy from a template, customise brand (logo, colours, copy, prompt style), set per-visitor quota and hard spend cap, publish, get a link and an embed snippet.
- One live view: total runs, free runs remaining, spend used versus cap, projected cost of next run, share rate, K-factor.
- Pause or kill a toy instantly.
- Billing: buy access, top up credits, set auto-top-up, see usage history.

---

## 5. Stack (production)

Stitch these. Each sits behind a thin interface so it can be swapped.

| Concern | Tool | Notes |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | App and toys |
| Styling | Tailwind | |
| Platform hosting | Vercel | App, Cron, OG, wildcard + custom domains |
| Database | Postgres (Neon or Supabase) + Prisma | Source of truth |
| Auth | Clerk | Dashboard owners only (toys are public). Email magic link or email+password, plus Google OAuth. Clerk handles verification, password reset, and sessions, so there is no custom auth code to build or secure |
| Payments | Stripe | Lifetime, subscription, credit top-ups, webhooks |
| Image generation | Google nano banana (Gemini image) | Primary; behind a provider interface |
| Generation fallback | fal.ai / Imagen | Secondary providers behind same interface |
| Background jobs | Upstash QStash (or Inngest) | Durable async generation, retries |
| Rate limit + quota counters | Upstash Redis (`@upstash/ratelimit`) | Per-visitor quota, per-toy and per-IP limits, spend-cap reservations |
| Object storage | Cloudflare R2 (S3-compatible) | Generated images and share cards; no egress fees. Vercel Blob acceptable alternative |
| Image moderation | Provider behind `moderateImage()` (Google Vision SafeSearch + face age check) | Input and output moderation |
| Share cards | Vercel OG (satori) | Dynamic per-result image |
| Analytics | PostHog | run, share, return events; K-factor |
| Transactional email | Resend | Receipts, alerts, onboarding |
| Bot protection | Cloudflare Turnstile | On the toy before generation |
| Error tracking | Sentry | App and toy runtime errors |

**Provider abstraction is mandatory** for generation and moderation. Generation cost trends to zero and models change. Never call a provider SDK directly from a route.

---

## 6. Data model (minimum, production)

```
Owner          id, email, plan (lifetime|monthly|none), stripe_customer_id,
               credit_balance_usd (derived/cached from ledger), auto_topup_enabled,
               auto_topup_threshold_usd, auto_topup_amount_usd, created_at

Toy            id, owner_id, name, slug (unique), template_id, status (draft|live|paused|killed),
               brand_config (json: logo, colours, copy, prompt_style, brand_url),
               per_visitor_quota, spend_cap_usd, spend_used_usd, spend_reserved_usd,
               watermark_enabled (true on launch tiers), custom_domain (nullable, unique),
               domain_status (none|pending|verifying|verified|error), domain_dns_target, created_at

GenerationJob  id, toy_id, visitor_id, status (queued|running|done|failed),
               input_ref, result_url, model, cost_usd, charged_usd, error, attempts, created_at

Run            id, toy_id, visitor_id, job_id, model, cost_usd, charged_usd (cost*markup, 0 if free),
               was_free, result_url, share_card_url, created_at

CreditLedger   id, owner_id, delta_usd (+ for top-up, - for spend), reason,
               run_id (nullable), stripe_event_id (nullable, for idempotency),
               balance_after_usd, created_at         // append-only, source of truth

ShareEvent     id, run_id, toy_id, channel, created_at
ReturnEvent    id, toy_id, utm_source, visitor_id, created_at
VisitorQuota   toy_id, visitor_id, runs_used         // durable backstop; Redis is the fast path

ModerationLog  id, toy_id, stage (input|output), verdict (pass|reject), reason, created_at
WebhookEvent   id, source, external_id (unique), processed_at   // Stripe/QStash idempotency
```

Owner credit balance is the sum of `CreditLedger.delta_usd`. Cache it on `Owner` but treat the ledger as truth. Every spend and every top-up writes a ledger row.

---

## 7. The spend cap (the sacred path)

This must be impossible to bypass under any concurrency. Implement a **reserve, generate, reconcile** pattern:

1. **Reserve.** Before generation, atomically check and reserve: `spend_used_usd + spend_reserved_usd + projected_charge <= spend_cap_usd` AND the owner has enough credit. Do the atomic check in Redis (the fast path) and mirror to Postgres. If it fails, return the graceful soft-wall state. If it passes, add `projected_charge` to `spend_reserved_usd`.
2. **Generate.** Run the job.
3. **Reconcile.** On success, move the actual `charged_usd` from reserved to `spend_used_usd`, write the Run and a CreditLedger debit, release any reservation remainder. On failure, release the full reservation and charge nothing.

Also implement:
- **Per-visitor quota** (default 3 free runs per visitor) checked before the reservation.
- **Per-toy and per-IP rate limits** via `@upstash/ratelimit`.
- **Free-run accounting:** the first `FREE_RUNS_PER_TOY` runs set `charged_usd = 0` and `was_free = true`, but still log `cost_usd` against our buffer and still respect the cap.
- **Kill switch:** a per-toy and a platform-wide flag that immediately stops all generation, served from cache so it takes effect instantly.

Write a concurrency test that fires many simultaneous requests at a toy near its cap and proves the cap is never exceeded.

---

## 8. Moderation and safety (non-negotiable, from day one)

A public photo-upload AI toy invites misuse. This is a first-class feature and a real ongoing cost, not an add-on.

- **Input moderation, before generation.** Run every uploaded image through `moderateImage()`. Reject NSFW, graphic violence, and any image that appears to depict a minor. Use SafeSearch-style likelihoods plus a face age-estimation check. **Images that appear to involve minors are rejected outright and never processed or stored.** This is a hard rule with no exceptions and no "probably fine" path.
- **Prompt moderation.** If the toy accepts text input, moderate it too. Reject attempts to steer generation toward disallowed content.
- **Output moderation, before display or share.** Re-check the generated image before it is shown or made shareable. A rejected output shows a graceful retry state and is not stored or shared.
- **Logging.** Every moderation decision writes a ModerationLog row.
- **Abuse protection.** Cloudflare Turnstile on the toy before generation to block bots. Per-IP rate limiting on top.
- **Defaults are safe.** When a moderation provider errors or times out, fail closed (reject), never fail open.

`moderateImage()` is behind a provider interface so the moderation backend can be swapped or strengthened without touching toy code.

---

## 9. Virality loop

- **Share card** via Vercel OG: a dynamic image per result showing the generated meme, a "Made with Catnip" watermark, and the owner brand attribution. Layout per the template spec.
- **Watermark on by default** on launch tiers. It is the distribution engine, every shared card markets Catnip.
- **Share buttons** that share the card with UTM params (`utm_source=catnip`, toy id). Each share writes a ShareEvent.
- **Return tracking:** a visitor landing via a Catnip UTM link writes a ReturnEvent.
- **Self-insert by default:** the user puts themselves into the toy (face, name), per the template.

---

## 10. Analytics and K-factor

- PostHog events: `run`, `share`, `return`.
- Compute **share rate** (shares / runs) and an approximate **K-factor** (shares per user times the conversion of those shares into returning new visitors), exposed for the dashboard.
- Respect cookie consent on the public toy (see compliance).

---

## 11. Pricing logic to implement

- `charged_usd = cost_usd * GENERATION_MARKUP` (2.5) on every billable run.
- First `FREE_RUNS_PER_TOY` (50) runs per toy: `charged_usd = 0`, still log cost.
- Lifetime ($420) buyers get a starting free-credit pool (config value, funded from the buffer).
- Every spend debits the credit ledger; every top-up credits it.
- Dashboard always shows: free runs remaining, spend used versus cap, projected next-run cost. No hidden numbers, ever (this is the brand promise made visible).
- **Auto top-up:** if enabled and balance falls below threshold, charge the saved Stripe payment method for the top-up amount and write a ledger credit. If disabled and balance hits zero, stop generation gracefully and prompt a top-up.

---

## 12. Reliability and ops

- **Error tracking:** Sentry on app and toy runtime, with release tagging.
- **Structured logging** with a request id threaded through generation jobs.
- **Retries:** generation and deploy operations retry with backoff via the job queue; surface terminal failures as graceful states, never raw errors to the public.
- **Idempotency:** all webhooks (Stripe, QStash) are idempotent via WebhookEvent unique external ids.
- **Graceful states everywhere:** cap hit, credits out, quota reached, moderation reject, generation failure, provider down. Each resolves to a branded state on the toy, never a stack trace.
- **Health checks** and a status flag the dashboard can read.
- **Reconciliation job (Vercel Cron):** periodically compare logged `cost_usd` against provider usage to catch drift, and flag any toy whose ledger and run totals disagree.

---

## 13. Security

- Validate and sanitise all input. Constrain uploads by type and size; scan before processing.
- Rate limit per IP and per visitor (Redis), plus Turnstile.
- Store generated assets in R2 behind signed URLs; do not expose raw provider URLs.
- Verify all webhook signatures (Stripe) before processing.
- Tenant isolation: a toy and its data belong to one owner; enforce ownership checks on every dashboard query.
- Secrets only in env, never in client bundles. The toy must never expose the generation key; all generation runs server-side or in the job worker.
- CORS configured for embeds: the toy renders in third-party iframes, the dashboard does not.

---

## 14. Legal and compliance (required before public traffic)

You operate from Germany, so GDPR is mandatory, not optional.

- **Consent on upload:** the public toy gets explicit consent before processing a photo, with a clear statement of what happens to the image.
- **Age gate / minor protection:** combined with input moderation rejecting apparent minors.
- **Data retention and deletion:** delete the user's uploaded source photo promptly after generation; keep generated results only per a stated retention window; provide a deletion path. Do not retain faces indefinitely.
- **Documents:** Terms of Service, Privacy Policy, Acceptable Use Policy. Link them on the toy and dashboard.
- **Cookie consent** for PostHog on the public toy.
- **Data processing:** record which sub-processors handle data (generation, moderation, storage, analytics) for the privacy policy and any DPA.

Implement the technical hooks (consent capture, retention deletion job, deletion endpoint) in the build. The legal copy itself is drafted separately, but the product must enforce these behaviours.

---

## 15. Environment / config (full)

```
# Generation
GEMINI_API_KEY=
IMAGE_PROVIDER=nano_banana
FAL_KEY=                          # fallback provider

# Moderation
MODERATION_PROVIDER=google_vision
GOOGLE_VISION_API_KEY=

# Jobs / rate limit / cache
QSTASH_TOKEN=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=

# Share cards / domains
NEXT_PUBLIC_APP_URL=
ROOT_DOMAIN=catnip.io

# Platform deploy (for future custom toys)
VERCEL_API_TOKEN=
VERCEL_TEAM_ID=

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=

# Data / auth / payments / email / errors
DATABASE_URL=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
SENTRY_DSN=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# Pricing
GENERATION_MARKUP=2.5
FREE_RUNS_PER_TOY=50
DEFAULT_PER_VISITOR_QUOTA=3
LIFETIME_STARTING_CREDIT_USD=
```

---

## 16. The template spec format (our IP, get this tight first)

A template is a markdown file that steers a coding agent to generate a complete, on-brand toy experience that plugs into all Catnip hooks. It is the most important artefact. Nail one before building breadth.

It must contain:
1. **Toy identity** — name, one-line description, the emotion it creates.
2. **User flow** — exact public end-user steps.
3. **Generation contract** — the exact prompt template fed to the image model, with slots for user input (photo, name) and brand customisation (style, colours, logo).
4. **Share card spec** — layout, data shown, watermark and attribution placement.
5. **Self-insert defaults** — how the user puts themselves in.
6. **Brand customisation surface** — what the owner can change without code (colours, logo, copy, prompt style).
7. **Required Catnip hooks** — the toy MUST call: spend-cap reservation, per-visitor quota, input and output moderation, generation job submission, share-card generation, and analytics events. These are non-optional.
8. **Guardrails** — moderation requirements, fail-closed behaviour, rate-limit handling, graceful states.

First template to write: `templates/meme-booth.md`.

**Sequencing note.** The build phases do not depend on the final template content. Phase 1 writes a first-pass `meme-booth.md` so the shell renders, with generation stubbed until Phase 2. The polished, on-brand template is refined later, using the production platform itself once it is live.

---

## 16A. The custom-experience builder (v1 stub, build later)

The full vision (pillar 1) is that a customer describes the experience they want and it runs through Catnip's coding workflow to generate or customise a toy, steered by a guiding context spec. **In v1 this builder is a deliberate placeholder.** The only experience that ships is the meme-booth template.

Stubbed now, filled in later (the owner will add these, do not build the generation workflow in v1):
- `templates/EXPERIENCE_GUIDE.md` — the context that guides a coding agent when generating a custom Catnip experience (how to structure a toy, which Catnip hooks are mandatory, the house taste). Create it as an empty placeholder file with a heading and a TODO.
- `templates/blocks/` — a library of reusable template blocks (meme booth, starter-pack generator, roast, persona-maker). Create the folder with a README placeholder only.

When the builder is built later, it will read `EXPERIENCE_GUIDE.md` and the blocks, run a coding agent, and produce a toy that plugs into the same multi-tenant rendering, metering, moderation, virality, and analytics layers built in v1. Nothing in v1 needs to change to enable it; it sits on top of the same foundation.

---

## 17. Hard rules for the coding agent

1. **The spend cap is sacred.** Reserve, generate, reconcile. It must be impossible to overspend under any load. Prove it with a concurrency test.
2. **Provider abstraction.** Never call a generation or moderation SDK directly from a route. Always go through `generateImage()` and `moderateImage()`.
3. **Moderation from day one, fail closed.** Reject NSFW, violence, and any apparent minor before generation, and re-check output. Never process or store images that appear to involve minors.
4. **Money is a ledger.** Every spend and top-up writes a CreditLedger row. Balance is derived. Webhooks are idempotent.
5. **No raw errors to the public.** Every failure path on the toy is a graceful branded state.
6. **Watermark on by default** on launch tiers.
7. **Multi-tenant, not per-toy deploys.** Toys render from config out of the one app.
8. **Tenant isolation.** Ownership checks on every dashboard query.
9. **Keep it lean.** Reuse the managed services in section 5. Do not rebuild auth, payments, storage, queues, moderation, rate limiting, or analytics.

---

## 18. Definition of production-ready done

- One meme booth toy, multi-tenant, live on a link and embeddable.
- Custom domains: an owner can attach their own domain to a toy, see the DNS record, get it verified, and serve the toy on it with SSL.
- Hard spend cap proven race-safe; per-visitor quota and rate limits enforced.
- Input and output moderation live, failing closed, rejecting apparent minors.
- Watermarked share card per result with working UTM tracking; share rate and K-factor in the dashboard.
- Owner can self-serve: create, customise, publish, set cap and quota, pause or kill, and see live usage and spend with no hidden numbers.
- Stripe billing live: $420 lifetime, $49/mo, credit top-ups, auto-top-up, idempotent webhooks, credit ledger correct.
- Transactional email: receipts, usage alerts (near cap, low credits), onboarding.
- Sentry, structured logging, retries, reconciliation cron, health checks.
- Security: signed URLs, verified webhooks, sanitised input, Turnstile, tenant isolation.
- Compliance hooks: upload consent, source-photo deletion, retention job, deletion endpoint, cookie consent, linked legal docs.
- Test coverage on the spend cap, the credit ledger, moderation, and the toy happy path.

---

## 19. Out of scope for v1 (do not build yet)

- More than one template.
- The custom-experience builder / coding-agent workflow (stubbed in v1, see section 16A).
- No-code template editor for non-technical users.
- Per-project Vercel deploys for custom vibe-coded toys.
- White-label, per-client agency analytics, SSO.
- Template marketplace.

---

## 20. First task

Write `templates/meme-booth.md` to the section 16 format. Make the generation contract specific enough that the agent produces a deployable, on-brand meme booth every time. Everything depends on that template being good.
