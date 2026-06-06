import { Redis } from "@upstash/redis";
import { requireEnv } from "@/lib/env";

/**
 * Upstash Redis client (claude.md §5). The fast path for per-visitor quota,
 * per-toy / per-IP rate limits, spend-cap reservations, and kill-switch flags.
 *
 * Lazily constructed so the app boots without Redis credentials configured.
 */
let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis({
      url: requireEnv("UPSTASH_REDIS_REST_URL"),
      token: requireEnv("UPSTASH_REDIS_REST_TOKEN"),
    });
  }
  return client;
}
