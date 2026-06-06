"use server";

import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBrandConfig } from "@/lib/toy/brand";
import { buildMemeBoothPrompt } from "@/lib/toy/prompt";
import { getOrCreateVisitorId } from "@/lib/toy/visitor";
import { moderateImage } from "@/lib/moderation";
import { isQStashConfigured, enqueueGenerationJob } from "@/lib/qstash";
import { processGenerationJob } from "@/jobs/generate";
import { log } from "@/lib/logger";

export type SubmitResult =
  | { ok: true; jobId: string }
  | { ok: false; reason: "not_available" | "moderation_rejected" | "no_photo" | "failed" };

/**
 * Submit a meme generation (claude.md §2.3, §4A, §8). Flow:
 *  1. re-check the toy is live (never trust the client)
 *  2. INPUT MODERATION on the raw upload BEFORE anything is stored or queued —
 *     reject NSFW / violence / apparent minors; the image is never stored
 *     (§8, hard rule #3). Fail closed.
 *  3. create a queued GenerationJob and hand it to QStash (durable async, §2.3);
 *     the toy then polls /api/jobs/[jobId]. In dev (no QSTASH_TOKEN) the worker
 *     runs inline via after().
 *
 * The photo is moderated here but NOT persisted in this phase; passing it
 * through to the generator (self-insert) is the next step (§9). Output
 * moderation runs in the worker before the result is stored.
 *
 * TODO: per-visitor quota + spend-cap reservation (§7), and prompt/name text
 * moderation (§8), also belong here before queueing.
 */
export async function submitMemeJob(formData: FormData): Promise<SubmitResult> {
  try {
    const slug = String(formData.get("slug") ?? "");
    const name = String(formData.get("name") ?? "");
    const photo = formData.get("photo");

    const toy = await prisma.toy.findUnique({ where: { slug } });
    if (!toy || toy.status !== "live") {
      return { ok: false, reason: "not_available" };
    }

    // Self-insert requires a photo.
    if (!(photo instanceof File) || photo.size === 0) {
      return { ok: false, reason: "no_photo" };
    }

    // INPUT MODERATION before generation, on the raw bytes, before storing (§8).
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const verdict = await moderateImage({
      stage: "input",
      imageBytes: bytes,
      mimeType: photo.type || "image/jpeg",
      toyId: toy.id,
    });
    if (verdict.verdict === "reject") {
      // Never processed or stored — we just drop the bytes.
      return { ok: false, reason: "moderation_rejected" };
    }

    const brand = parseBrandConfig(toy.brandConfig, toy.name);
    const prompt = buildMemeBoothPrompt(brand, name);
    const visitorId = await getOrCreateVisitorId();

    const job = await prisma.generationJob.create({
      data: {
        toyId: toy.id,
        visitorId,
        status: "queued",
        input: { prompt, name: name.trim() },
      },
    });

    if (isQStashConfigured()) {
      await enqueueGenerationJob(job.id);
    } else {
      after(() => processGenerationJob(job.id));
    }

    return { ok: true, jobId: job.id };
  } catch (error) {
    log.error("submitMemeJob failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: "failed" };
  }
}
