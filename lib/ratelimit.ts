import { Ratelimit } from "@upstash/ratelimit";
import { getRedis, isRedisConfigured } from "@/lib/redis";

/**
 * Rate limiting (claude.md §7, §13) via @upstash/ratelimit on top of Redis.
 * Per-IP and per-toy limits sit in front of generation to blunt abuse and bots.
 *
 * Limiters are built lazily (and cached) so importing this module doesn't touch
 * Redis at boot. When Redis isn't configured (dev/CI) the checks degrade to
 * "allowed" — rate limiting is abuse protection, not a correctness invariant
 * (the spend cap is the hard guarantee). TODO: tune windows/limits with traffic.
 */
let perIp: Ratelimit | null = null;
let perToy: Ratelimit | null = null;

function getPerIpLimiter(): Ratelimit {
  if (!perIp) {
    perIp = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "catnip:rl:ip",
      analytics: true,
    });
  }
  return perIp;
}

function getPerToyLimiter(): Ratelimit {
  if (!perToy) {
    perToy = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(120, "1 m"),
      prefix: "catnip:rl:toy",
      analytics: true,
    });
  }
  return perToy;
}

/** Per-IP limit — coarse abuse protection across all toys. */
export async function checkIpRateLimit(ip: string): Promise<boolean> {
  if (!isRedisConfigured()) return true;
  const { success } = await getPerIpLimiter().limit(ip);
  return success;
}

/** Per-toy limit — protects a single toy from a localized flood. */
export async function checkToyRateLimit(toyId: string): Promise<boolean> {
  if (!isRedisConfigured()) return true;
  const { success } = await getPerToyLimiter().limit(toyId);
  return success;
}
