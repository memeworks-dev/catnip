import { Client } from "@upstash/qstash";
import { NotImplementedError } from "@/lib/errors";
import { requireEnv } from "@/lib/env";

/**
 * Upstash QStash (claude.md §5, §2.3): durable async generation jobs with
 * retries. The public toy submits a job, the worker (an /app/api route) is
 * invoked by QStash, then the toy polls/subscribes for the result.
 *
 * Lazily constructed so the app boots without QSTASH_TOKEN.
 */
let client: Client | null = null;

export function getQStash(): Client {
  if (!client) {
    client = new Client({ token: requireEnv("QSTASH_TOKEN") });
  }
  return client;
}

/**
 * Enqueue a generation job to be processed by the worker route.
 * TODO: publish to `${NEXT_PUBLIC_APP_URL}/api/jobs/generate` with the job id,
 * configure retries/backoff (§12), and dedupe.
 */
export async function enqueueGenerationJob(_jobId: string): Promise<void> {
  throw new NotImplementedError("qstash.enqueueGenerationJob");
}

/**
 * Verify an inbound QStash request signature before processing (§13).
 * TODO: use `Receiver` with QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY
 * (add these to env when wiring the worker), then mark idempotent via
 * WebhookEvent (§12).
 */
export async function verifyQStashSignature(
  _signature: string,
  _body: string,
): Promise<boolean> {
  throw new NotImplementedError("qstash.verifyQStashSignature");
}
