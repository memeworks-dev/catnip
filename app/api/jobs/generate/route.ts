/**
 * Generation worker endpoint (claude.md §2.3). Invoked by Upstash QStash.
 * Scaffold stub.
 *
 * When built:
 *  1. verify the QStash signature (§13) and dedupe via WebhookEvent (§12)
 *  2. delegate to processGenerationJob(jobId) in /jobs/generate.ts
 *  3. return 2xx so QStash marks it delivered; throw to trigger a retry
 */
export async function POST() {
  return new Response("Not implemented", { status: 501 });
}
