import { processGenerationJob } from "@/jobs/generate";

/**
 * Generation worker endpoint (claude.md §2.3). Invoked by Upstash QStash with
 * `{ jobId }`. Delegates to processGenerationJob, which handles its own retries
 * and marks terminal failures, so this returns 2xx once the job is processed.
 *
 * TODO (§13): verify the QStash signature (Receiver + signing keys) and dedupe
 * via the WebhookEvent table (§12) before processing.
 */
export async function POST(request: Request) {
  let jobId: string | undefined;
  try {
    const body = (await request.json()) as { jobId?: string };
    jobId = body?.jobId;
  } catch {
    // fall through to the 400 below
  }
  if (!jobId) {
    return new Response("Missing jobId", { status: 400 });
  }

  await processGenerationJob(jobId);
  return Response.json({ ok: true });
}
