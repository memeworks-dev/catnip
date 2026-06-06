import { NotImplementedError } from "@/lib/errors";
import { getPostHog } from "@/lib/analytics/posthog";

export { getPostHog } from "@/lib/analytics/posthog";

/**
 * Analytics + K-factor (claude.md §10). Thin typed event helpers over PostHog.
 *
 * The capture helpers no-op gracefully when PostHog isn't configured, so the
 * run/share/return paths never fail on analytics. (The dashboard K-factor
 * computation is a §10 follow-up.)
 */

export interface RunEvent {
  toyId: string;
  visitorId: string;
  runId: string;
  wasFree: boolean;
}

export interface ShareEvent {
  toyId: string;
  visitorId: string;
  runId: string;
  channel: string;
}

export interface ReturnEvent {
  toyId: string;
  visitorId?: string;
  utmSource?: string;
}

async function capture(
  distinctId: string,
  event: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const ph = getPostHog();
  if (!ph) return; // not configured — no-op
  ph.capture({ distinctId, event, properties });
  await ph.flush(); // serverless: ensure delivery
}

export async function captureRun(event: RunEvent): Promise<void> {
  await capture(event.visitorId, "run", {
    toy_id: event.toyId,
    run_id: event.runId,
    was_free: event.wasFree,
  });
}

export async function captureShare(event: ShareEvent): Promise<void> {
  await capture(event.visitorId, "share", {
    toy_id: event.toyId,
    run_id: event.runId,
    channel: event.channel,
  });
}

export async function captureReturn(event: ReturnEvent): Promise<void> {
  await capture(event.visitorId ?? "anonymous", "return", {
    toy_id: event.toyId,
    utm_source: event.utmSource,
  });
}

export interface ViralityMetrics {
  shareRate: number;
  kFactor: number;
}

/** Share rate + approximate K-factor for a toy's dashboard (§10). */
export async function getViralityMetrics(
  _toyId: string,
): Promise<ViralityMetrics> {
  throw new NotImplementedError("analytics.getViralityMetrics");
}
