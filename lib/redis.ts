import { Redis } from "@upstash/redis";
import { optionalEnv, requireEnv } from "@/lib/env";

/**
 * Upstash Redis client (claude.md §5). The fast path for per-visitor quota,
 * per-toy / per-IP rate limits, kill-switch flags, and a spend mirror for fast
 * dashboard reads.
 *
 * Lazily constructed so the app boots without Redis credentials configured.
 */
let client: Redis | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(
    optionalEnv("UPSTASH_REDIS_REST_URL") &&
      optionalEnv("UPSTASH_REDIS_REST_TOKEN"),
  );
}

export function getRedis(): Redis {
  if (!client) {
    client = new Redis({
      url: requireEnv("UPSTASH_REDIS_REST_URL"),
      token: requireEnv("UPSTASH_REDIS_REST_TOKEN"),
    });
  }
  return client;
}
