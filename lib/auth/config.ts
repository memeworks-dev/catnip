import { optionalEnv } from "@/lib/env";

/**
 * Whether Clerk is configured (claude.md §5). Kept in its own tiny module (no
 * prisma / clerk-server imports) so the root layout and proxy can read the flag
 * cheaply. When false, the dashboard runs in a dev-open mode (no auth) so the app
 * boots and is usable without Clerk keys; production sets the keys.
 */
export function isClerkConfigured(): boolean {
  return Boolean(
    optionalEnv("CLERK_SECRET_KEY") &&
      optionalEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
  );
}
