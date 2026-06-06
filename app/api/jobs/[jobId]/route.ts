import { prisma } from "@/lib/prisma";

/**
 * Job status for the public toy to poll (claude.md §2.3). The toy submits, then
 * polls this until `done` (with a result URL) or `failed` (→ graceful state).
 *
 * Deliberately minimal: no cost or internal error detail is exposed to the
 * public — failures map to a generic flag (§12, §13).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: { status: true, resultUrl: true },
  });
  if (!job) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({
    status: job.status,
    resultUrl: job.status === "done" ? job.resultUrl : null,
    failed: job.status === "failed",
  });
}
