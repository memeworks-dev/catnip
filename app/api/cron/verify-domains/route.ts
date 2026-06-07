import { verifyPendingDomains } from "@/jobs/verify-domains";
import { optionalEnv } from "@/lib/env";

/**
 * Vercel Cron endpoint to verify pending custom domains (claude.md §2A step 4).
 * Vercel sends `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set;
 * we reject anything else so the endpoint can't be triggered by the public.
 */
export async function GET(request: Request) {
  const secret = optionalEnv("CRON_SECRET");
  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const result = await verifyPendingDomains();
  return Response.json({ ok: true, ...result });
}
