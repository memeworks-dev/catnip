import * as Sentry from "@sentry/nextjs";

/**
 * Sentry error tracking (claude.md §5, §12). Thin wrapper so call sites don't
 * import the SDK directly and we can add release tagging / breadcrumbs in one
 * place.
 *
 * NOTE: full Next.js wiring (instrumentation.ts with register() + onRequestError,
 * a client config, and withSentryConfig in next.config) is NOT added yet so the
 * build stays clean without a DSN. Run `npx @sentry/wizard@latest -i nextjs` or
 * follow the README "Sentry" section to complete it. Sentry.init with no DSN is
 * a safe no-op, so these wrappers are inert until configured.
 */

export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(message: string): void {
  Sentry.captureMessage(message);
}
