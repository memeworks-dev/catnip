import { PostHog } from "posthog-node";
import { optionalEnv } from "@/lib/env";

/**
 * PostHog server client (claude.md §5, §10) for `run`, `share`, `return` events
 * captured server-side. The browser-side client lives in lib/analytics/client.
 *
 * Lazily constructed. Returns null when not configured so server code can no-op
 * cleanly rather than crash a generation.
 */
let client: PostHog | null = null;

export function getPostHog(): PostHog | null {
  if (client) return client;
  const key = optionalEnv("NEXT_PUBLIC_POSTHOG_KEY");
  if (!key) return null;
  client = new PostHog(key, {
    host: optionalEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.posthog.com"),
  });
  return client;
}
