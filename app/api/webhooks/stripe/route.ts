/**
 * Stripe webhook receiver (claude.md §11, §12, §13). Scaffold stub.
 *
 * When built:
 *  1. read the raw body + `stripe-signature` header
 *  2. verify via getStripe().webhooks.constructEvent(body, sig, webhookSecret)
 *  3. dedupe on event.id via the WebhookEvent table (idempotency, §12)
 *  4. on checkout/payment: write a CreditLedger credit (money is a ledger, §4)
 *     and update Owner.plan / credit balance; send a receipt (§12)
 *
 * Note: the body must be read raw (not JSON-parsed) for signature verification.
 */
export async function POST() {
  return new Response("Not implemented", { status: 501 });
}
