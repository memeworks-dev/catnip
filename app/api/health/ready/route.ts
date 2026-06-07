import { prisma } from "@/lib/prisma";
import { optionalEnv } from "@/lib/env";
import { isClerkConfigured } from "@/lib/auth/config";
import { isRedisConfigured } from "@/lib/redis";

/**
 * Readiness check (claude.md §12). Unlike /api/health (liveness), this verifies
 * the dependencies the dashboard and toys actually need, so a deploy problem is
 * diagnosable without digging through Vercel logs:
 *  - is DATABASE_URL set, can we reach Postgres, and has the schema been applied?
 *  - is Clerk configured? (dashboard auth)
 *
 * Returns Prisma error CODES (e.g. P2021 = table missing, P1001 = unreachable),
 * never the connection string, so it's safe to leave reachable. 200 when ready,
 * 503 otherwise.
 */
export const dynamic = "force-dynamic";

interface ProbeError {
  code?: string;
  hint: string;
}

const HINTS: Record<string, string> = {
  P1000: "Database authentication failed — check the credentials in DATABASE_URL.",
  P1001: "Can't reach the database — check the host/port in DATABASE_URL and that the DB accepts connections.",
  P1003: "Database does not exist — check the database name in DATABASE_URL.",
  P2021: "Tables are missing — migrations haven't been applied. Redeploy (build runs `prisma migrate deploy`) or run `npm run db:deploy`.",
};

function probe(error: unknown): ProbeError {
  const code = (error as { code?: string })?.code;
  return { code, hint: (code && HINTS[code]) || "Database error — see the code above." };
}

export async function GET(): Promise<Response> {
  const checks: Record<string, unknown> = {
    databaseUrlSet: Boolean(optionalEnv("DATABASE_URL")),
    clerkConfigured: isClerkConfigured(),
    redisConfigured: isRedisConfigured(),
  };
  let ok = true;

  if (!checks.databaseUrlSet) {
    ok = false;
    checks.database = "no_url";
    checks.hint = "DATABASE_URL is not set in this environment.";
  } else {
    try {
      // Connectivity.
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "reachable";
      try {
        // Schema presence (throws P2021 if the table is missing).
        await prisma.owner.count();
        checks.schema = "ready";
      } catch (error) {
        ok = false;
        checks.schema = "missing";
        checks.schemaError = probe(error);
      }
    } catch (error) {
      ok = false;
      checks.database = "unreachable";
      checks.databaseError = probe(error);
    }
  }

  return Response.json({ ok, checks, time: new Date().toISOString() }, { status: ok ? 200 : 503 });
}
