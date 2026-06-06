import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";

/**
 * Rate limiting (claude.md §7, §13) via @upstash/ratelimit on top of Redis.
 * Per-IP and per-toy limits sit in front of Turnstile to blunt abuse and bots.
 *
 * Limiters are built lazily (and cached) so importing this module doesn't touch
 * Redis at boot. TODO: tune windows/limits once real traffic shapes are known.
 */

let perIp: Ratelimit | null = null;
let perToy: Ratelimit | null = null;

/** Per-IP limit — coarse abuse protection across all toys. */
export function getPerIpLimiter(): Ratelimit {
  if (!perIp) {
    perIp = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "rl:ip",
      analytics: true,
    });
  }
  return perIp;
}

/** Per-toy limit — protects a single toy from a localized flood. */
export function getPerToyLimiter(): Ratelimit {
  if (!perToy) {
    perToy = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(120, "1 m"),
      prefix: "rl:toy",
      analytics: true,
    });
  }
  return perToy;
}
