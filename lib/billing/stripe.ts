import Stripe from "stripe";
import { requireEnv } from "@/lib/env";

/**
 * Stripe client (claude.md §5, §11): $420 lifetime, $49/mo subscription, credit
 * top-ups, auto-top-up, and idempotent webhooks.
 *
 * Lazily constructed so the app boots without STRIPE_SECRET_KEY. Pin the API
 * version here when wiring so behaviour is deterministic across deploys.
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  }
  return client;
}

/**
 * Construct + verify a webhook event from the raw body and signature (§13).
 * TODO: call getStripe().webhooks.constructEvent(body, signature, secret) and
 * dedupe via the WebhookEvent table (§12) before acting.
 */
export function getWebhookSecret(): string {
  return requireEnv("STRIPE_WEBHOOK_SECRET");
}
