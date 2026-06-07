"use client";

import posthog from "posthog-js";

/**
 * PostHog browser client (claude.md §10). Initialised on the public toy AFTER
 * cookie consent (§14) — only via grantConsent() below.
 */
export function initPostHogBrowser(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === "undefined") return;
  if (posthog.__loaded) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.posthog.com",
    capture_pageview: false,
    // Respect consent — start opted out, opt in once the user accepts.
    opt_out_capturing_by_default: true,
  });
}

/** Visitor accepted cookies — init PostHog and opt in. */
export function grantConsent(): void {
  initPostHogBrowser();
  if (posthog.__loaded) posthog.opt_in_capturing();
}

/** Visitor declined — ensure PostHog is opted out. */
export function revokeConsent(): void {
  if (posthog.__loaded) posthog.opt_out_capturing();
}

export { posthog };
