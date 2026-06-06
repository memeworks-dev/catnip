import { Client } from "@upstash/qstash";
import { NotImplementedError } from "@/lib/errors";
import { appConfig, optionalEnv, requireEnv } from "@/lib/env";

/**
 * Upstash QStash (claude.md §5, §2.3): durable async generation jobs with
 * retries. The toy submits a job, QStash invokes the worker route, then the toy
 * polls for the result.
 *
 * Lazily constructed so the app boots without QSTASH_TOKEN.
 */
let client: Client | null = null;

export function isQStashConfigured(): boolean {
  return Boolean(optionalEnv("QSTASH_TOKEN"));
}

export function getQStash(): Client {
  if (!client) {
    client = new Client({ token: requireEnv("QSTASH_TOKEN") });
  }
  return client;
}

/**
 * Enqueue a generation job: QStash delivers a POST to the worker route with the
 * job id, retrying with backoff on non-2xx (§2.3, §12).
 */
export async function enqueueGenerationJob(jobId: string): Promise<void> {
  await getQStash().publishJSON({
    url: `${appConfig.appUrl}/api/jobs/generate`,
    body: { jobId },
    retries: 3,
  });
}

/**
 * Verify an inbound QStash request signature before processing (§13).
 * TODO: use `Receiver` with QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY
 * (add these to env when wiring), then mark idempotent via WebhookEvent (§12).
 */
export async function verifyQStashSignature(
  _signature: string,
  _body: string,
): Promise<boolean> {
  throw new NotImplementedError("qstash.verifyQStashSignature");
}
