import { NotImplementedError } from "@/lib/errors";

/**
 * THE SACRED PATH (claude.md §7, hard rule #1).
 *
 * The hard spend cap must be impossible to bypass under ANY concurrency. The
 * pattern is reserve → generate → reconcile:
 *
 *   1. reserve()    atomically check `spend_used + spend_reserved + projected <=
 *                   spend_cap` AND owner has credit, then add `projected` to
 *                   spend_reserved. Atomic in Redis (fast path), mirrored to
 *                   Postgres. NEVER a naive read-then-write — that races.
 *   2. generate     run the job.
 *   3. reconcile()  move actual charged_usd from reserved → spend_used, write a
 *                   Run + a CreditLedger debit, release any remainder.
 *      release()    on failure, release the full reservation, charge nothing.
 *
 * A concurrency test (§7) must fire many simultaneous requests at a toy near its
 * cap and prove the cap is never exceeded.
 *
 * Everything here is a typed stub for now — the real implementation uses a Redis
 * Lua script (or atomic INCRBY with compensation) for step 1.
 */

export interface ReservationRequest {
  toyId: string;
  ownerId: string;
  /** Projected charge for this run (markup applied), from estimateCostUsd × markup. */
  projectedChargeUsd: number;
  requestId?: string;
}

export interface Reservation {
  id: string;
  toyId: string;
  amountUsd: number;
}

export type ReserveResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; reason: "spend_cap" | "insufficient_credit" | "kill_switch" };

/**
 * Step 1 — atomically reserve budget against the toy cap and owner credit.
 * Returns a soft-wall reason instead of throwing, so the toy shows a graceful
 * "taking a break" state (§7), never an error.
 */
export async function reserve(
  _request: ReservationRequest,
): Promise<ReserveResult> {
  // TODO: atomic check-and-reserve in Redis, mirror to Toy.spend_reserved_usd.
  throw new NotImplementedError("spendCap.reserve");
}

/**
 * Step 3 (success) — settle a reservation with the actual charged amount, move
 * reserved → used, write Run + CreditLedger debit, release any remainder.
 */
export async function reconcile(
  _reservation: Reservation,
  _actualChargeUsd: number,
): Promise<void> {
  // TODO: transactional reconcile across Redis + Postgres ledger.
  throw new NotImplementedError("spendCap.reconcile");
}

/** Step 3 (failure) — release the full reservation and charge nothing. */
export async function release(_reservation: Reservation): Promise<void> {
  // TODO: release reserved budget in Redis + Postgres.
  throw new NotImplementedError("spendCap.release");
}
