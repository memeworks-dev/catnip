import { prisma } from "@/lib/prisma";
import { generateImage } from "@/lib/generation";
import { storeGeneratedImage } from "@/lib/storage";
import { parseBrandConfig } from "@/lib/toy/brand";
import { computeChargeUsd, isFreeRun } from "@/lib/metering/pricing";
import { withRetry } from "@/lib/retry";
import { log } from "@/lib/logger";

/**
 * Generation worker (claude.md §2.3). Invoked by QStash via /api/jobs/generate
 * (or inline in dev). Runs generateImage() through the provider interface, stores
 * the result in R2, updates the job to `done` with cost_usd + a signed result
 * URL, and writes a Run on success.
 *
 * Retries with backoff on transient failure (withRetry); a terminal failure
 * marks the job `failed` so the toy shows a graceful state (§12), never an error.
 *
 * TODO (next): input moderation on the source photo before generation, output
 * moderation before storing, and the spend-cap reserve/reconcile around this
 * (§7, §8). For now generation runs against the built prompt.
 */
function extForMime(mime: string): string {
  if (mime.includes("svg")) return "svg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

export async function processGenerationJob(jobId: string): Promise<void> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    include: { toy: true },
  });
  if (!job) {
    log.warn("generation job not found", { jobId });
    return;
  }
  // Idempotent: QStash may redeliver a job that already completed (§12).
  if (job.status === "done") return;

  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: "running", attempts: { increment: 1 } },
  });

  const input = (job.input as { prompt?: string; name?: string } | null) ?? {};
  const brand = parseBrandConfig(job.toy.brandConfig, job.toy.name);

  try {
    const result = await withRetry(
      () =>
        generateImage({
          prompt: input.prompt ?? "",
          caption: input.name ?? "",
          brand: {
            brandName: brand.brandName ?? job.toy.name,
            primary: brand.colors.primary,
            accent: brand.colors.accent,
            text: brand.colors.text,
          },
          requestId: job.id,
        }),
      {
        retries: 2,
        baseDelayMs: 500,
        onRetry: (attempt, error) =>
          log.warn("generateImage retry", {
            jobId,
            attempt,
            error: error instanceof Error ? error.message : String(error),
          }),
      },
    );

    const key = `toys/${job.toyId}/results/${job.id}.${extForMime(result.mimeType)}`;
    const resultUrl = await storeGeneratedImage(
      key,
      result.imageBytes,
      result.mimeType,
    );

    // First FREE_RUNS_PER_TOY runs per toy are free; cost is still logged (§11).
    const priorRuns = await prisma.run.count({ where: { toyId: job.toyId } });
    const wasFree = isFreeRun(priorRuns);
    const chargedUsd = wasFree ? 0 : computeChargeUsd(result.costUsd);

    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "done",
        model: result.model,
        costUsd: result.costUsd,
        chargedUsd,
        resultUrl,
      },
    });

    // Write the Run on success (§6, §11).
    await prisma.run.create({
      data: {
        toyId: job.toyId,
        visitorId: job.visitorId,
        jobId: job.id,
        model: result.model,
        costUsd: result.costUsd,
        chargedUsd,
        wasFree,
        resultUrl,
      },
    });

    log.info("generation job done", { jobId, model: result.model, wasFree });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "failed", error: message },
    });
    log.error("generation job failed (terminal)", { jobId, error: message });
  }
}
