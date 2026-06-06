import { prisma } from "@/lib/prisma";
import { generateImage } from "@/lib/generation";
import { moderateImage } from "@/lib/moderation";
import { storeGeneratedImage } from "@/lib/storage";
import { renderShareCard } from "@/lib/share/card";
import { isRasterImageRef } from "@/lib/share/util";
import { parseBrandConfig } from "@/lib/toy/brand";
import {
  reconcileSuccess,
  reconcileFailure,
  type Reservation,
} from "@/lib/metering/spend-cap";
import { withRetry } from "@/lib/retry";
import { log } from "@/lib/logger";

/**
 * Generation worker (claude.md §2.3, §7, §8). Invoked by QStash via
 * /api/jobs/generate (or inline in dev). Implements the back half of the sacred
 * path:
 *   generate (with retry+backoff) → OUTPUT MODERATION before storing → store in
 *   R2 → RECONCILE the spend reservation (success: move reserved→used, write Run
 *   + CreditLedger; failure/reject: release the reservation, charge nothing).
 *
 * The reservation was made at submit (reserve → generate → reconcile). A
 * terminal failure or rejected output marks the job `failed` so the toy shows a
 * graceful state (§12), never an error.
 *
 * TODO: pass the source photo through for self-insert (§9).
 */
function extForMime(mime: string): string {
  if (mime.includes("svg")) return "svg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

interface JobInput {
  prompt?: string;
  name?: string;
  reservation?: { projectedChargeUsd?: number; isFree?: boolean };
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

  const input = (job.input as JobInput | null) ?? {};
  const brand = parseBrandConfig(job.toy.brandConfig, job.toy.name);

  // The reservation made at submit. Defaults keep directly-created jobs (tests)
  // working: release/charge nothing.
  const reservation: Reservation = {
    toyId: job.toyId,
    ownerId: job.toy.ownerId,
    projectedChargeUsd: input.reservation?.projectedChargeUsd ?? 0,
    isFree: input.reservation?.isFree ?? true,
  };

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

    // OUTPUT MODERATION before storing or sharing (§8). A rejected output is
    // never stored; release the reservation and fail to a graceful state.
    const output = await moderateImage({
      stage: "output",
      imageBytes: result.imageBytes,
      mimeType: result.mimeType,
      toyId: job.toyId,
      requestId: job.id,
    });
    if (output.verdict === "reject") {
      await reconcileFailure(reservation);
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { status: "failed", error: `output_moderation_rejected:${output.reason ?? ""}` },
      });
      log.warn("output moderation rejected — not stored", {
        jobId,
        reason: output.reason,
      });
      return;
    }

    const key = `toys/${job.toyId}/results/${job.id}.${extForMime(result.mimeType)}`;
    const resultUrl = await storeGeneratedImage(
      key,
      result.imageBytes,
      result.mimeType,
    );

    // RECONCILE (success): release reservation, book actual spend, write Run +
    // CreditLedger debit (§7, §11).
    const { runId, chargedUsd } = await reconcileSuccess({
      reservation,
      jobId: job.id,
      visitorId: job.visitorId,
      model: result.model,
      costUsd: result.costUsd,
      resultUrl,
    });

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

    // Share card (§9): render with Vercel OG, store in R2, save on the Run. The
    // meme bytes are embedded directly so satori doesn't need to refetch. Failure
    // here is non-fatal — the run still succeeds.
    try {
      const memeDataUri = `data:${result.mimeType};base64,${Buffer.from(result.imageBytes).toString("base64")}`;
      const card = renderShareCard({
        memeUrl: memeDataUri,
        isRaster: isRasterImageRef(memeDataUri),
        caption: input.name?.trim() || undefined,
        brandName: brand.brandName ?? job.toy.name,
        logoUrl: brand.logoUrl,
        watermark: job.toy.watermarkEnabled,
        primary: brand.colors.primary,
        accent: brand.colors.accent,
      });
      const cardBytes = new Uint8Array(await card.arrayBuffer());
      const cardKey = `toys/${job.toyId}/cards/${runId}.png`;
      const shareCardUrl = await storeGeneratedImage(cardKey, cardBytes, "image/png");
      await prisma.run.update({ where: { id: runId }, data: { shareCardUrl } });
    } catch (cardError) {
      log.warn("share card generation failed (non-fatal)", {
        jobId,
        runId,
        error: cardError instanceof Error ? cardError.message : String(cardError),
      });
    }

    log.info("generation job done", { jobId, model: result.model });
  } catch (error) {
    // RECONCILE (failure): release the full reservation, charge nothing (§7).
    await reconcileFailure(reservation);
    const message = error instanceof Error ? error.message : String(error);
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "failed", error: message },
    });
    log.error("generation job failed (terminal)", { jobId, error: message });
  }
}
