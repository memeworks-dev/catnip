"use server";

import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBrandConfig } from "@/lib/toy/brand";
import { buildMemeBoothPrompt } from "@/lib/toy/prompt";
import { getOrCreateVisitorId } from "@/lib/toy/visitor";
import { isQStashConfigured, enqueueGenerationJob } from "@/lib/qstash";
import { processGenerationJob } from "@/jobs/generate";
import { log } from "@/lib/logger";

export type SubmitResult =
  | { ok: true; jobId: string }
  | { ok: false; reason: "not_available" | "failed" };

export interface SubmitMemeInput {
  slug: string;
  name: string;
}

/**
 * Submit a meme generation (claude.md §2.3, §4A). Creates a queued
 * GenerationJob and hands it to QStash for durable async processing; the toy
 * then polls /api/jobs/[jobId] for the result.
 *
 * In dev (no QSTASH_TOKEN) the worker runs inline via `after()` so the poll
 * still completes without a queue.
 *
 * TODO before real generation: upload + input-moderate the source photo (§8) and
 * run the per-visitor quota + spend-cap reservation (§7) here.
 */
export async function submitMemeJob(
  input: SubmitMemeInput,
): Promise<SubmitResult> {
  try {
    // Never trust the client about toy status — re-check server-side.
    const toy = await prisma.toy.findUnique({ where: { slug: input.slug } });
    if (!toy || toy.status !== "live") {
      return { ok: false, reason: "not_available" };
    }

    const brand = parseBrandConfig(toy.brandConfig, toy.name);
    const prompt = buildMemeBoothPrompt(brand, input.name);
    const visitorId = await getOrCreateVisitorId();

    const job = await prisma.generationJob.create({
      data: {
        toyId: toy.id,
        visitorId,
        status: "queued",
        input: { prompt, name: input.name.trim() },
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
