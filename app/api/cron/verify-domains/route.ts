import { verifyPendingDomains } from "@/jobs/verify-domains";
import { optionalEnv } from "@/lib/env";
import { log } from "@/lib/logger";

/**
 * Custom-domain verification cron endpoint (claude.md §2A, §12). Scheduled by
 * Vercel Cron (see vercel.json) and also safe to call on demand.
 *
 * Auth: Vercel Cron automatically sends `Authorization: Bearer ${CRON_SECRET}`
 * when CRON_SECRET is set. We require it when present; if it's unset we allow the
 * call but warn, so the cron works the moment it's deployed and is locked down as
 * soon as the secret is added.
 */
export const dynamic = "force-dynamic";
// Allow time to poll several domains against the Vercel API in one run.
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const secret = optionalEnv("CRON_SECRET");
  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  } else {
    log.warn("verify-domains cron is unauthenticated — set CRON_SECRET");
  }

  const result = await verifyPendingDomains();
  return Response.json({ ok: true, ...result });
}
