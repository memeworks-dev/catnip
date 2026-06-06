import { NotImplementedError } from "@/lib/errors";

/**
 * Reconciliation cron (claude.md §12). Runs on Vercel Cron. Compares logged
 * cost_usd against provider usage to catch drift, and flags any toy whose
 * ledger and run totals disagree (money correctness, §4).
 */
export async function reconcileUsage(): Promise<void> {
  throw new NotImplementedError("jobs.reconcileUsage");
}
