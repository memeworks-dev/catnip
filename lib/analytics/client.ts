"use client";

import posthog from "posthog-js";

/**
 * PostHog browser client (claude.md §10). Initialised on the public toy AFTER
 * cookie consent (§14) — do not call this before consent is given.
 *
 * TODO: gate on the consent banner, mount in a client provider component.
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

export { posthog };
