import { NotImplementedError } from "@/lib/errors";

export { getResend } from "@/lib/email/resend";

/**
 * Transactional email (claude.md §12, §18). Typed senders over Resend.
 * TODO: build React email templates and wire getResend().emails.send(...).
 */

export async function sendReceipt(
  _ownerEmail: string,
  _data: { amountUsd: number; description: string },
): Promise<void> {
  throw new NotImplementedError("email.sendReceipt");
}

/** Near-cap / low-credit alerts so an owner is never surprised (§1, §11). */
export async function sendUsageAlert(
  _ownerEmail: string,
  _data: { kind: "near_cap" | "low_credits" | "credits_out"; toyName?: string },
): Promise<void> {
  throw new NotImplementedError("email.sendUsageAlert");
}

export async function sendOnboardingEmail(_ownerEmail: string): Promise<void> {
  throw new NotImplementedError("email.sendOnboardingEmail");
}
