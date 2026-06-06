import { pricing } from "@/lib/env";

/**
 * Pricing math (claude.md §11). Pure functions, no I/O.
 *
 * Money is rounded to 4 decimal places to match the Decimal(12,4) columns and
 * avoid float drift in the ledger.
 */

export function roundUsd(amount: number): number {
  return Math.round(amount * 1e4) / 1e4;
}

/** charged_usd = cost_usd * GENERATION_MARKUP (2.5). */
export function computeChargeUsd(costUsd: number): number {
  return roundUsd(costUsd * pricing.markup);
}

/**
 * Whether this run is free: the first FREE_RUNS_PER_TOY (50) runs per toy are
 * free — charged 0 but cost is still logged against our buffer (§11).
 * `priorRunCount` is the toy's run count BEFORE this run.
 */
export function isFreeRun(priorRunCount: number): boolean {
  return priorRunCount < pricing.freeRunsPerToy;
}

/** Free runs remaining for a toy, for the dashboard "no hidden numbers" view. */
export function freeRunsRemaining(priorRunCount: number): number {
  return Math.max(0, pricing.freeRunsPerToy - priorRunCount);
}
