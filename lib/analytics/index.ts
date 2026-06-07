import { getPostHog } from "@/lib/analytics/posthog";

export { getPostHog } from "@/lib/analytics/posthog";
export {
  getViralityMetrics,
  getShareRate,
  getKFactor,
  type ViralityMetrics,
} from "@/lib/analytics/kfactor";

/**
 * Analytics event pipeline (claude.md §10): `run`, `share`, `return` to PostHog,
 * keyed by visitor id with a toy id property.
 *
 * IMPORTANT: callers gate these on cookie consent (lib/consent) before invoking —
 * PostHog is a third-party processor (§14). The helpers themselves no-op when
 * PostHog isn't configured, so they never fail a run/share/return.
 *
 * The dashboard's share rate / K-factor come from our own rows (see kfactor.ts),
 * not from PostHog.
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
    visitor_id: event.visitorId,
    run_id: event.runId,
    was_free: event.wasFree,
  });
}

export async function captureShare(event: ShareEvent): Promise<void> {
  await capture(event.visitorId, "share", {
    toy_id: event.toyId,
    visitor_id: event.visitorId,
    run_id: event.runId,
    channel: event.channel,
  });
}

export async function captureReturn(event: ReturnEvent): Promise<void> {
  await capture(event.visitorId ?? "anonymous", "return", {
    toy_id: event.toyId,
    visitor_id: event.visitorId,
    utm_source: event.utmSource,
  });
}
