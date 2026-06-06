/**
 * Retry with exponential backoff (claude.md §12). Used by the generation worker
 * so a transient provider error doesn't fail a run on the first try. QStash
 * provides the durable outer retry layer; this is the inner one.
 */

export interface RetryOptions {
  /** Number of retries AFTER the first attempt (default 2 → up to 3 tries). */
  retries?: number;
  /** Base delay; attempt n waits baseDelayMs * 2^n. */
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 500;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      options.onRetry?.(attempt, error);
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelayMs * 2 ** attempt),
        );
      }
    }
  }
  throw lastError;
}
