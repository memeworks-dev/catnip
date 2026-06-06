import { Ratelimit } from "@upstash/ratelimit";
import { prisma } from "@/lib/prisma";
import { getRedis, isRedisConfigured } from "@/lib/redis";

/**
 * Per-visitor quota (claude.md §7). Default DEFAULT_PER_VISITOR_QUOTA (3) runs
 * per visitor, checked BEFORE the spend-cap reservation.
 *
 * Fast path: @upstash/ratelimit (fixed window) when Redis is configured.
 * Durable backstop: the VisitorQuota table via an atomic upsert — also the path
 * used in dev/CI without Redis. Either way the limit is enforced race-safely.
 */

export type QuotaResult =
  | { ok: true; remaining: number }
  | { ok: false; remaining: 0 };

// Window for the Redis fast path. Cumulative semantics are used by the Postgres
// backstop; the Redis path resets per window.
const WINDOW = "1 d" as const;

// One Ratelimit instance per limit value (the limit is fixed at construction).
const limiters = new Map<number, Ratelimit>();
function getVisitorLimiter(limit: number): Ratelimit {
  let limiter = limiters.get(limit);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.fixedWindow(limit, WINDOW),
      prefix: "catnip:quota",
      analytics: true,
    });
    limiters.set(limit, limiter);
  }
  return limiter;
}

/**
 * Atomically check and consume one unit of a visitor's quota. Returns ok:false
 * when exhausted so the toy shows the soft wall (§7), not an error.
 */
export async function checkAndConsumeQuota(params: {
  toyId: string;
  visitorId: string;
  limit: number;
}): Promise<QuotaResult> {
  const { toyId, visitorId, limit } = params;
  if (limit <= 0) return { ok: false, remaining: 0 };

  if (isRedisConfigured()) {
    const res = await getVisitorLimiter(limit).limit(`${toyId}:${visitorId}`);
    return res.success
      ? { ok: true, remaining: res.remaining }
      : { ok: false, remaining: 0 };
  }

  // Durable backstop (atomic): insert the row at 1, or increment only while
  // still under the limit. 0 rows affected => quota exhausted.
  const affected = await prisma.$executeRaw`
    INSERT INTO visitor_quota (toy_id, visitor_id, runs_used)
    VALUES (${toyId}, ${visitorId}, 1)
    ON CONFLICT (toy_id, visitor_id)
    DO UPDATE SET runs_used = visitor_quota.runs_used + 1
    WHERE visitor_quota.runs_used < ${limit}`;

  if (affected === 0) return { ok: false, remaining: 0 };

  const row = await prisma.visitorQuota.findUnique({
    where: { toyId_visitorId: { toyId, visitorId } },
    select: { runsUsed: true },
  });
  return { ok: true, remaining: Math.max(0, limit - (row?.runsUsed ?? limit)) };
}
