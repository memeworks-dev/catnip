import { NotImplementedError } from "@/lib/errors";

/**
 * Data retention / deletion cron (claude.md §14, GDPR). Runs on Vercel Cron.
 *
 *  - Source photos are deleted promptly after generation (defence in depth here
 *    in case the inline delete in the generation job missed one).
 *  - Generated results are deleted past the stated retention window.
 *  - Faces are not retained indefinitely.
 */
export async function runRetentionSweep(): Promise<void> {
  throw new NotImplementedError("jobs.runRetentionSweep");
}

/**
 * Right-to-erasure endpoint helper (§14): delete a specific visitor's data on
 * request. Wired to a deletion endpoint.
 */
export async function deleteVisitorData(_visitorId: string): Promise<void> {
  throw new NotImplementedError("jobs.deleteVisitorData");
}
