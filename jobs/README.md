# /jobs

Background work. These are **plain functions** invoked by thin `/app/api` route
handlers — Catnip does not run a separate worker process (multi-tenant, single
app — claude.md §2).

| Job | Trigger | Spec |
|---|---|---|
| `generate.ts` → `processGenerationJob` | Upstash QStash → `POST /api/jobs/generate` | §2.3, §7, §8 |
| `reconcile.ts` → `reconcileUsage` | Vercel Cron | §12 |
| `retention.ts` → `runRetentionSweep`, `deleteVisitorData` | Vercel Cron + deletion endpoint | §14 |
| `verify-domains.ts` → `verifyPendingDomains` | Vercel Cron + dashboard "check now" | §2A |

Rules that apply to every job:

- **Idempotent**: inbound webhooks (QStash) are deduped via the `WebhookEvent`
  table (§12).
- **Verify signatures** before processing (§13).
- **Retries with backoff** are owned by QStash; terminal failures surface as
  graceful states on the toy, never raw errors (§12).

`verify-domains.ts` is implemented (custom domains, §2A) and runs via
`/api/cron/verify-domains`; `reconcile.ts` and `retention.ts` are still typed
stubs (`NotImplementedError`).
