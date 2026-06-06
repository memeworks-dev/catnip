import { NotImplementedError } from "@/lib/errors";

export { getStripe, getWebhookSecret } from "@/lib/billing/stripe";

/**
 * Credit ledger (claude.md §4, §11). Money is a ledger, not a number: every
 * spend and every top-up writes an append-only CreditLedger row, and the owner
 * balance is DERIVED from the ledger (cached on Owner). Webhooks are idempotent
 * via stripe_event_id.
 *
 * Typed stubs for now.
 */

export interface LedgerEntryInput {
  ownerId: string;
  /** + for top-up, - for spend. */
  deltaUsd: number;
  reason: string;
  runId?: string;
  /** Idempotency key for Stripe-driven credits. */
  stripeEventId?: string;
}

/**
 * Append a ledger row inside a transaction, recompute balance_after_usd, and
 * update the cached Owner.credit_balance_usd. Idempotent on stripeEventId.
 */
export async function recordLedgerEntry(
  _entry: LedgerEntryInput,
): Promise<void> {
  // TODO: transactional insert + cached-balance update (§4).
  throw new NotImplementedError("billing.recordLedgerEntry");
}

/** Authoritative balance = SUM(CreditLedger.delta_usd) for an owner. */
export async function getBalanceUsd(_ownerId: string): Promise<number> {
  // TODO: SUM over the ledger (source of truth), reconcile the cache.
  throw new NotImplementedError("billing.getBalanceUsd");
}

/**
 * Auto-top-up (§11): if enabled and balance < threshold, charge the saved
 * payment method for the top-up amount and write a ledger credit.
 */
export async function maybeAutoTopUp(_ownerId: string): Promise<void> {
  throw new NotImplementedError("billing.maybeAutoTopUp");
}
