import { prisma } from "@/lib/prisma";
import {
  getDomainStatus,
  serializeRecords,
  isDomainsConfigured,
} from "@/lib/domains";
import { log } from "@/lib/logger";

export interface VerifyDomainsResult {
  checked: number;
  verified: number;
}

/**
 * Custom-domain verification cron (claude.md §2A). Runs on Vercel Cron and is
 * also triggered by the dashboard "check now" action. For every toy whose domain
 * is still settling (pending / verifying / error), it polls Vercel and advances
 * the state toward verified — refreshing the DNS record so the owner always sees
 * the truth, never a dead end.
 *
 * Idempotent and safe to run repeatedly. A transient Vercel/API error leaves the
 * toy unchanged (logged, retried next run) rather than flipping it to a bad
 * state. The toy keeps serving on its catnip.io slug throughout (§2A).
 */
export async function verifyPendingDomains(): Promise<VerifyDomainsResult> {
  if (!isDomainsConfigured()) {
    log.warn("verifyPendingDomains skipped: Vercel domains not configured");
    return { checked: 0, verified: 0 };
  }

  const toys = await prisma.toy.findMany({
    where: {
      customDomain: { not: null },
      domainStatus: { in: ["pending", "verifying", "error"] },
    },
    select: { id: true, customDomain: true },
  });

  let verified = 0;
  for (const toy of toys) {
    if (!toy.customDomain) continue;
    try {
      const result = await getDomainStatus(toy.customDomain);
      await prisma.toy.update({
        where: { id: toy.id },
        data: {
          domainStatus: result.status,
          // Keep the existing record on an empty/error response — never blank it.
          ...(result.records.length
            ? { domainDnsTarget: serializeRecords(result.records) }
            : {}),
        },
      });
      if (result.status === "verified") verified++;
    } catch (error) {
      log.warn("domain verify check failed (left unchanged)", {
        toyId: toy.id,
        domain: toy.customDomain,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  log.info("verifyPendingDomains done", { checked: toys.length, verified });
  return { checked: toys.length, verified };
}
