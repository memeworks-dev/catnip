import { NotImplementedError } from "@/lib/errors";

export { getPostHog } from "@/lib/analytics/posthog";

/**
 * Analytics + K-factor (claude.md §10). Thin typed event helpers over PostHog.
 * Compute share rate (shares / runs) and an approximate K-factor for the
 * dashboard. Respect cookie consent on the public toy (§14).
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

export async function captureRun(_event: RunEvent): Promise<void> {
  throw new NotImplementedError("analytics.captureRun");
}

export async function captureShare(_event: ShareEvent): Promise<void> {
  throw new NotImplementedError("analytics.captureShare");
}

export async function captureReturn(_event: ReturnEvent): Promise<void> {
  throw new NotImplementedError("analytics.captureReturn");
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
