import { prisma } from "@/lib/prisma";
import { appConfig } from "@/lib/env";
import { log } from "@/lib/logger";
import {
  googleVisionProvider,
  isGoogleVisionConfigured,
} from "@/lib/moderation/providers/google-vision";
import { localModerationProvider } from "@/lib/moderation/providers/local";
import type {
  ModerationProvider,
  ModerationResult,
  ModerationStage,
} from "@/lib/moderation/types";

/**
 * The single moderation interface (claude.md §8, §17 rule 2/3). Routes and jobs
 * call ONLY moderateImage()/moderateText() — never a provider SDK directly.
 *
 * Guarantees on every call:
 *  - FAIL CLOSED: any provider error or timeout => reject (§8, hard rule #3).
 *  - A ModerationLog row is written for EVERY decision, pass or reject (§8).
 */

const TIMEOUT_MS = 8000;

const PROVIDERS: Record<string, ModerationProvider> = {
  [googleVisionProvider.id]: googleVisionProvider,
  [localModerationProvider.id]: localModerationProvider,
};

function selectProvider(): ModerationProvider {
  const provider = PROVIDERS[appConfig.moderationProvider] ?? googleVisionProvider;
  // Dev convenience: if the real provider isn't configured and we're not in
  // production, allow with the local provider so the toy is testable. PRODUCTION
  // never silently allows — an unconfigured provider throws and we fail closed.
  if (
    provider.id === "google_vision" &&
    !isGoogleVisionConfigured() &&
    process.env.NODE_ENV !== "production"
  ) {
    return localModerationProvider;
  }
  return provider;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("moderation timeout")),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function logDecision(
  toyId: string,
  stage: ModerationStage,
  result: ModerationResult,
): Promise<void> {
  try {
    await prisma.moderationLog.create({
      data: { toyId, stage, verdict: result.verdict, reason: result.reason ?? null },
    });
  } catch (error) {
    // Never let logging failure change the verdict.
    log.error("failed to write ModerationLog", {
      toyId,
      stage,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface ModerateImageRequest {
  stage: ModerationStage;
  imageBytes: Uint8Array;
  mimeType: string;
  toyId: string;
  requestId?: string;
}

/** Moderate an image (input before generation, output before display, §8). */
export async function moderateImage(
  req: ModerateImageRequest,
): Promise<ModerationResult> {
  let result: ModerationResult;
  try {
    const provider = selectProvider();
    result = await withTimeout(
      provider.moderateImage({
        imageBytes: req.imageBytes,
        mimeType: req.mimeType,
        toyId: req.toyId,
        requestId: req.requestId,
      }),
      TIMEOUT_MS,
    );
  } catch (error) {
    log.error("image moderation failed — failing closed (reject)", {
      stage: req.stage,
      toyId: req.toyId,
      error: error instanceof Error ? error.message : String(error),
    });
    result = { verdict: "reject", reason: "moderation_unavailable" };
  }
  await logDecision(req.toyId, req.stage, result);
  return result;
}

export interface ModerateTextRequest {
  stage: ModerationStage;
  text: string;
  toyId: string;
}

/** Moderate free text (prompt / name), §8. Fails closed and logs like images. */
export async function moderateText(
  req: ModerateTextRequest,
): Promise<ModerationResult> {
  let result: ModerationResult;
  try {
    const provider = selectProvider();
    result = await withTimeout(provider.moderateText(req.text), TIMEOUT_MS);
  } catch (error) {
    log.error("text moderation failed — failing closed (reject)", {
      toyId: req.toyId,
      error: error instanceof Error ? error.message : String(error),
    });
    result = { verdict: "reject", reason: "moderation_unavailable" };
  }
  await logDecision(req.toyId, req.stage, result);
  return result;
}
