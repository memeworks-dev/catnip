import { cookies } from "next/headers";
import { CONSENT_COOKIE } from "@/lib/consent-constants";

/**
 * Server-side analytics consent check (claude.md §10, §14). PostHog (a
 * third-party processor) is only sent events when the visitor has accepted
 * cookies on the public toy. Our own first-party rows (Run / ShareEvent /
 * ReturnEvent) are still written — they power the owner's dashboard and metering
 * and carry only a pseudonymous functional visitor id.
 */
export async function hasAnalyticsConsent(): Promise<boolean> {
  const store = await cookies();
  return store.get(CONSENT_COOKIE)?.value === "granted";
}
