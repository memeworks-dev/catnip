import { prisma } from "@/lib/prisma";
import { getRedis, isRedisConfigured } from "@/lib/redis";
import { computeChargeUsd, isFreeRun } from "@/lib/metering/pricing";
import { log } from "@/lib/logger";

/**
 * THE SACRED PATH (claude.md §7, hard rule #1): reserve → generate → reconcile.
 * The hard spend cap must be impossible to bypass under ANY concurrency.
 *
 * Authority: the binding atomic reservation is a Postgres conditional UPDATE
 * (`SET spend_reserved_usd = spend_reserved_usd + charge WHERE used + reserved +
 * charge <= cap`). A conditional UPDATE re-evaluates its WHERE under a row lock,
 * so concurrent reservers serialize on the toy row — the cap can never be
 * exceeded. This is also durable: it survives a Redis outage, which matters for
 * the "never a surprise bill" promise (a Redis-only counter would lose the cap
 * if the cache flushed).
 *
 * Owner credit is reserved race-safely too: inside the same transaction we lock
 * the owner row and require credit_balance >= SUM(spend_reserved across the
 * owner's toys), so concurrent reservations across toys can't oversell credit.
 *
 * Redis (§7 "fast path") mirrors the spend numbers best-effort for fast reads;
 * quota / rate limits / kill switch use Redis directly (see sibling modules).
 */

export interface Reservation {
  toyId: string;
  ownerId: string;
  /** Amount added to spend_reserved_usd (0 for a free run). Released on reconcile. */
  projectedChargeUsd: number;
  /** Whether this run is free (first FREE_RUNS_PER_TOY runs, §11). */
  isFree: boolean;
}

export type ReserveResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; reason: "spend_cap" | "insufficient_credit" };

/** Internal signal used to roll back a reservation on the credit check. */
class InsufficientCreditSignal extends Error {}

/**
 * Decide free-run status + the charge to reserve for a run (§11). Free runs
 * reserve 0 (they don't consume the cap budget) but still flow through reserve.
 * The free/charge decision is locked in here and carried on the Reservation.
 */
export async function computeRunCharge(
  toyId: string,
  estimatedCostUsd: number,
): Promise<{ isFree: boolean; chargeUsd: number }> {
  const priorRuns = await prisma.run.count({ where: { toyId } });
  const free = isFreeRun(priorRuns);
  return {
    isFree: free,
    chargeUsd: free ? 0 : computeChargeUsd(estimatedCostUsd),
  };
}

/**
 * Step 1 — atomically reserve budget against the toy cap and the owner credit.
 * Returns a soft-wall reason instead of throwing, so the toy shows a graceful
 * state (§7), never an error.
 */
export async function reserve(params: {
  toyId: string;
  ownerId: string;
  chargeUsd: number;
  isFree: boolean;
}): Promise<ReserveResult> {
  const { toyId, ownerId, chargeUsd, isFree } = params;

  try {
    const reservation = await prisma.$transaction(
      async (tx) => {
      // Serialize this owner's reservations so the credit check below is
      // race-safe across all of the owner's toys.
      if (chargeUsd > 0) {
        await tx.$queryRaw`SELECT credit_balance_usd FROM owners WHERE id = ${ownerId} FOR UPDATE`;
      }

      // Atomic cap reservation. 0 rows => the cap would be exceeded.
      const reserved = await tx.$executeRaw`
        UPDATE toys
           SET spend_reserved_usd = spend_reserved_usd + ${chargeUsd}::numeric
         WHERE id = ${toyId}
           AND spend_used_usd + spend_reserved_usd + ${chargeUsd}::numeric <= spend_cap_usd`;
      if (reserved === 0) {
        return { ok: false as const, reason: "spend_cap" as const };
      }

      // Credit check: balance must cover ALL outstanding reservations for the
      // owner (this one is already counted). If not, throw to roll back the
      // reservation we just made (releases it), then surface insufficient_credit.
      if (chargeUsd > 0) {
        const rows = await tx.$queryRaw<
          Array<{ balance: string; outstanding: string }>
        >`
          SELECT o.credit_balance_usd AS balance,
                 COALESCE(
                   (SELECT SUM(t.spend_reserved_usd) FROM toys t WHERE t.owner_id = ${ownerId}),
                   0
                 ) AS outstanding
            FROM owners o
           WHERE o.id = ${ownerId}`;
        const balance = Number(rows[0]?.balance ?? 0);
        const outstanding = Number(rows[0]?.outstanding ?? 0);
        if (balance < outstanding) {
          throw new InsufficientCreditSignal();
        }
      }

      return {
        ok: true as const,
        reservation: { toyId, ownerId, projectedChargeUsd: chargeUsd, isFree },
      };
      },
      { maxWait: 20000, timeout: 20000 },
    );

    if (reservation.ok) void mirrorSpend(toyId);
    return reservation;
  } catch (error) {
    if (error instanceof InsufficientCreditSignal) {
      return { ok: false, reason: "insufficient_credit" };
    }
    throw error;
  }
}

/**
 * Step 3 (success) — settle a reservation with the ACTUAL cost: release the
 * reserved amount, add the actual charge to spend_used, write the Run, and (for
 * billable runs) write a CreditLedger debit + update the cached owner balance.
 */
export async function reconcileSuccess(params: {
  reservation: Reservation;
  jobId: string;
  visitorId: string;
  model: string;
  costUsd: number;
  resultUrl: string;
}): Promise<{ chargedUsd: number; wasFree: boolean }> {
  const { reservation, jobId, visitorId, model, costUsd, resultUrl } = params;
  const { toyId, ownerId, projectedChargeUsd, isFree } = reservation;
  const chargedUsd = isFree ? 0 : computeChargeUsd(costUsd);

  await prisma.$transaction(async (tx) => {
    // Move reserved -> used (release the projected reservation, book the actual).
    await tx.$executeRaw`
      UPDATE toys
         SET spend_reserved_usd = GREATEST(spend_reserved_usd - ${projectedChargeUsd}::numeric, 0),
             spend_used_usd = spend_used_usd + ${chargedUsd}::numeric
       WHERE id = ${toyId}`;

    await tx.run.create({
      data: {
        toyId,
        visitorId,
        jobId,
        model,
        costUsd,
        chargedUsd,
        wasFree: isFree,
        resultUrl,
      },
    });

    // Money is a ledger (§4): a billable run writes a debit + updates the cache.
    if (chargedUsd > 0) {
      const owner = await tx.owner.findUniqueOrThrow({
        where: { id: ownerId },
        select: { creditBalanceUsd: true },
      });
      const balanceAfter = Number(owner.creditBalanceUsd) - chargedUsd;
      const run = await tx.run.findUniqueOrThrow({
        where: { jobId },
        select: { id: true },
      });
      await tx.creditLedger.create({
        data: {
          ownerId,
          deltaUsd: -chargedUsd,
          reason: "run",
          runId: run.id,
          balanceAfterUsd: balanceAfter,
        },
      });
      await tx.owner.update({
        where: { id: ownerId },
        data: { creditBalanceUsd: balanceAfter },
      });
    }
  });

  void mirrorSpend(toyId);
  return { chargedUsd, wasFree: isFree };
}

/** Step 3 (failure) — release the full reservation and charge nothing. */
export async function reconcileFailure(reservation: Reservation): Promise<void> {
  await prisma.$executeRaw`
    UPDATE toys
       SET spend_reserved_usd = GREATEST(spend_reserved_usd - ${reservation.projectedChargeUsd}::numeric, 0)
     WHERE id = ${reservation.toyId}`;
  void mirrorSpend(reservation.toyId);
}

/**
 * Best-effort Redis mirror of the toy's spend numbers for fast dashboard reads
 * (§7 "fast path"). Never affects correctness — Postgres is authoritative — so
 * failures are swallowed.
 */
async function mirrorSpend(toyId: string): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    const toy = await prisma.toy.findUnique({
      where: { id: toyId },
      select: { spendUsedUsd: true, spendReservedUsd: true, spendCapUsd: true },
    });
    if (!toy) return;
    await getRedis().hset(`catnip:spend:${toyId}`, {
      used: Number(toy.spendUsedUsd),
      reserved: Number(toy.spendReservedUsd),
      cap: Number(toy.spendCapUsd),
    });
  } catch (error) {
    log.warn("spend mirror to Redis failed (non-fatal)", {
      toyId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
