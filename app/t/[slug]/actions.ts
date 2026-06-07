"use server";

import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBrandConfig } from "@/lib/toy/brand";
import { buildMemeBoothPrompt } from "@/lib/toy/prompt";
import { getOrCreateVisitorId, getClientIp } from "@/lib/toy/visitor";
import { hasAnalyticsConsent } from "@/lib/consent";
import { moderateImage } from "@/lib/moderation";
import { estimateCostUsd } from "@/lib/generation";
import { pricing } from "@/lib/env";
import { isGenerationKilled } from "@/lib/metering/kill-switch";
import { checkIpRateLimit, checkToyRateLimit } from "@/lib/ratelimit";
import { checkAndConsumeQuota } from "@/lib/metering/quota";
import { computeRunCharge, reserve } from "@/lib/metering/spend-cap";
import { isQStashConfigured, enqueueGenerationJob } from "@/lib/qstash";
import { processGenerationJob } from "@/jobs/generate";
import { log } from "@/lib/logger";

/** Soft-wall reasons map to graceful states on the toy (§7, §12). */
export type SubmitReason =
  | "not_available"
  | "paused"
  | "rate_limited"
  | "quota_reached"
  | "spend_cap"
  | "credits_out"
  | "moderation_rejected"
  | "no_photo"
  | "failed";

export type SubmitResult =
  | { ok: true; jobId: string }
  | { ok: false; reason: SubmitReason };

/**
 * Submit a meme generation (claude.md §2.3, §4A, §7, §8). Governance runs here,
 * in order, before any generation is queued:
 *   1. kill switch (platform + toy) — instant stop (§7)
 *   2. per-IP + per-toy rate limits (§7, §13)
 *   3. per-visitor quota (§7)
 *   4. input moderation on the raw upload, before anything is stored (§8)
 *   5. spend-cap RESERVE (cap + owner credit), atomic & race-safe (§7)
 * On any soft wall we return a reason → graceful state, never an error.
 *
 * The reservation is carried on the job so the worker can reconcile it
 * (reserve → generate → reconcile). The worker generates, output-moderates, and
 * reconciles (success: Run + ledger; failure: release).
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

    // 1. Kill switch — served from cache, takes effect instantly (§7).
    if (await isGenerationKilled(toy.id)) {
      return { ok: false, reason: "paused" };
    }

    // 2. Rate limits (§7, §13).
    const ip = await getClientIp();
    const [ipOk, toyOk] = await Promise.all([
      checkIpRateLimit(ip),
      checkToyRateLimit(toy.id),
    ]);
    if (!ipOk || !toyOk) {
      return { ok: false, reason: "rate_limited" };
    }

    const visitorId = await getOrCreateVisitorId();

    // 3. Per-visitor quota, BEFORE reserving (§7).
    const quota = await checkAndConsumeQuota({
      toyId: toy.id,
      visitorId,
      limit: toy.perVisitorQuota || pricing.defaultPerVisitorQuota,
    });
    if (!quota.ok) {
      return { ok: false, reason: "quota_reached" };
    }

    // Self-insert requires a photo.
    if (!(photo instanceof File) || photo.size === 0) {
      return { ok: false, reason: "no_photo" };
    }

    // 4. Input moderation on the raw bytes, before anything is stored (§8).
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const verdict = await moderateImage({
      stage: "input",
      imageBytes: bytes,
      mimeType: photo.type || "image/jpeg",
      toyId: toy.id,
    });
    if (verdict.verdict === "reject") {
      return { ok: false, reason: "moderation_rejected" };
    }

    // 5. Spend-cap RESERVE (§7, hard rule #1) — atomic, race-safe.
    const brand = parseBrandConfig(toy.brandConfig, toy.name);
    const prompt = buildMemeBoothPrompt(brand, name);
    const estCost = estimateCostUsd({ prompt });
    const { isFree, chargeUsd } = await computeRunCharge(toy.id, estCost);
    const reservation = await reserve({
      toyId: toy.id,
      ownerId: toy.ownerId,
      chargeUsd,
      isFree,
    });
    if (!reservation.ok) {
      return {
        ok: false,
        reason: reservation.reason === "spend_cap" ? "spend_cap" : "credits_out",
      };
    }

    // Consent for PostHog (§10, §14) — captured now so the async worker can gate
    // the `run` event without the visitor's request cookies.
    const analyticsConsent = await hasAnalyticsConsent();

    const job = await prisma.generationJob.create({
      data: {
        toyId: toy.id,
        visitorId,
        status: "queued",
        input: {
          prompt,
          name: name.trim(),
          reservation: {
            projectedChargeUsd: reservation.reservation.projectedChargeUsd,
            isFree: reservation.reservation.isFree,
          },
          analyticsConsent,
        },
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
