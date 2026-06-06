import { NotImplementedError } from "@/lib/errors";

/**
 * Custom-domain verification cron (claude.md §2A). Runs on Vercel Cron (and is
 * also triggered by the dashboard "check now" button). Polls Vercel for each
 * toy with domain_status pending/verifying and advances it to verified or error,
 * never a dead end.
 */
export async function verifyPendingDomains(): Promise<void> {
  throw new NotImplementedError("jobs.verifyPendingDomains");
}
