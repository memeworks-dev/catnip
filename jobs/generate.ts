import { NotImplementedError } from "@/lib/errors";

/**
 * Generation worker (claude.md §2.3, §7, §8). Invoked by QStash via
 * /app/api/jobs/generate after the public toy submits a job. This is where the
 * sacred path runs end to end:
 *
 *   1. verify the QStash signature + idempotency (WebhookEvent)
 *   2. load the GenerationJob; check kill switch
 *   3. input moderation (fail closed) — reject apparent minors, never store
 *   4. generateImage() through the provider interface
 *   5. output moderation (fail closed) before storing/sharing
 *   6. store result + share card in R2 (signed URLs)
 *   7. reconcile the spend reservation → Run + CreditLedger debit
 *   8. capture the `run` analytics event
 *   9. delete the source photo (§14 retention)
 *
 * Retries with backoff are handled by QStash; terminal failures resolve to a
 * graceful state on the toy, never a raw error (§12).
 */
export async function processGenerationJob(_jobId: string): Promise<void> {
  throw new NotImplementedError("jobs.processGenerationJob");
}
