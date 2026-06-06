import { Resend } from "resend";
import { requireEnv } from "@/lib/env";

/**
 * Resend client (claude.md §5, §12): transactional email — receipts, usage
 * alerts (near cap, low credits), onboarding.
 *
 * Lazily constructed so the app boots without RESEND_API_KEY.
 */
let client: Resend | null = null;

export function getResend(): Resend {
  if (!client) {
    client = new Resend(requireEnv("RESEND_API_KEY"));
  }
  return client;
}
