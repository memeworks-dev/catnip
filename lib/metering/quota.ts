import { NotImplementedError } from "@/lib/errors";

/**
 * Per-visitor quota (claude.md §7). Default DEFAULT_PER_VISITOR_QUOTA (3) free
 * runs per visitor, checked BEFORE the spend-cap reservation.
 *
 * Redis is the fast path; the VisitorQuota table is the durable backstop that
 * survives cache loss.
 */

export interface QuotaCheck {
  toyId: string;
  visitorId: string;
  /** Toy.per_visitor_quota. */
  limit: number;
}

export type QuotaResult =
  | { ok: true; runsUsed: number; remaining: number }
  | { ok: false; runsUsed: number; remaining: 0 };

/**
 * Atomically check and consume one unit of a visitor's quota. Returns ok:false
 * when exhausted so the toy can show the soft wall (§7), not an error.
 */
export async function checkAndConsumeQuota(
  _check: QuotaCheck,
): Promise<QuotaResult> {
  // TODO: atomic INCR in Redis with a Postgres VisitorQuota mirror as backstop.
  throw new NotImplementedError("quota.checkAndConsumeQuota");
}

/** Read remaining quota without consuming (for the dashboard / pre-checks). */
export async function getQuotaRemaining(_check: QuotaCheck): Promise<number> {
  throw new NotImplementedError("quota.getQuotaRemaining");
}
