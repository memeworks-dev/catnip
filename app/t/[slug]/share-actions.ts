"use server";

import { prisma } from "@/lib/prisma";
import { getOrCreateVisitorId } from "@/lib/toy/visitor";
import { hasAnalyticsConsent } from "@/lib/consent";
import { captureShare, captureReturn } from "@/lib/analytics";
import { log } from "@/lib/logger";

/** Allowed share channels (§9). Anything else is ignored. */
const CHANNELS = new Set(["x", "whatsapp", "copy_link", "instagram", "facebook"]);

/**
 * Record a share of a result's card (claude.md §9). Writes a ShareEvent and emits
 * the analytics `share` event. Best-effort: never blocks the user's share.
 */
export async function recordShare(input: {
  runId: string;
  channel: string;
}): Promise<void> {
  try {
    const channel = CHANNELS.has(input.channel) ? input.channel : "other";
    const run = await prisma.run.findUnique({
      where: { id: input.runId },
      select: { id: true, toyId: true, visitorId: true },
    });
    if (!run) return;

    await prisma.shareEvent.create({
      data: { runId: run.id, toyId: run.toyId, channel },
    });
    // PostHog only with consent (§10, §14); the ShareEvent row is first-party.
    if (await hasAnalyticsConsent()) {
      await captureShare({
        toyId: run.toyId,
        visitorId: run.visitorId,
        runId: run.id,
        channel,
      });
    }
  } catch (error) {
    log.warn("recordShare failed (non-fatal)", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Record a visitor landing via a Catnip UTM link (claude.md §9). Writes a
 * ReturnEvent and emits the analytics `return` event. Called once on mount when
 * utm_source=catnip.
 */
export async function recordReturn(input: {
  toyId: string;
  utmSource: string;
}): Promise<void> {
  try {
    const visitorId = await getOrCreateVisitorId();
    await prisma.returnEvent.create({
      data: { toyId: input.toyId, utmSource: input.utmSource, visitorId },
    });
    // PostHog only with consent (§10, §14); the ReturnEvent row is first-party.
    if (await hasAnalyticsConsent()) {
      await captureReturn({
        toyId: input.toyId,
        visitorId,
        utmSource: input.utmSource,
      });
    }
  } catch (error) {
    log.warn("recordReturn failed (non-fatal)", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
