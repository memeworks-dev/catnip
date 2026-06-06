/**
 * Centralised, typed access to environment configuration (claude.md §15).
 *
 * Reads are lazy and never throw at import time, so `next dev` boots even with
 * an empty `.env`. A secret is only *required* at the moment a feature actually
 * uses it (via {@link requireEnv}), which keeps the scaffold runnable before any
 * managed service is wired.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/** Returns the value or throws a clear error pointing at .env.example. */
export function requireEnv(name: string): string {
  const value = read(name);
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`,
    );
  }
  return value;
}

/** Returns the value, or `fallback` (which may be undefined). */
export function optionalEnv(name: string): string | undefined;
export function optionalEnv(name: string, fallback: string): string;
export function optionalEnv(name: string, fallback?: string): string | undefined {
  return read(name) ?? fallback;
}

function numberEnv(name: string, fallback: number): number {
  const raw = read(name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Pricing knobs (claude.md §11). Getters so a value can change without a
 * reboot and so nothing is evaluated at import time.
 */
export const pricing = {
  /** charged_usd = cost_usd * markup */
  get markup(): number {
    return numberEnv("GENERATION_MARKUP", 2.5);
  },
  /** First N runs per toy are free (charged 0, cost still logged). */
  get freeRunsPerToy(): number {
    return numberEnv("FREE_RUNS_PER_TOY", 50);
  },
  /** Default free runs per visitor before the soft wall. */
  get defaultPerVisitorQuota(): number {
    return numberEnv("DEFAULT_PER_VISITOR_QUOTA", 3);
  },
  /** Starting free-credit pool granted to $420 lifetime buyers. */
  get lifetimeStartingCreditUsd(): number {
    return numberEnv("LIFETIME_STARTING_CREDIT_USD", 0);
  },
};

/** Non-secret app configuration with sensible defaults. */
export const appConfig = {
  get appUrl(): string {
    return optionalEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  },
  get rootDomain(): string {
    return optionalEnv("ROOT_DOMAIN", "catnip.io");
  },
  /** Active generation provider key — see lib/generation. */
  get imageProvider(): string {
    return optionalEnv("IMAGE_PROVIDER", "nano_banana");
  },
  /** Active moderation provider key — see lib/moderation. */
  get moderationProvider(): string {
    return optionalEnv("MODERATION_PROVIDER", "google_vision");
  },
};
