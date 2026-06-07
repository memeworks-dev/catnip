import { prisma } from "@/lib/prisma";
import { getDomainStatus } from "@/lib/domains";
import { log } from "@/lib/logger";

/**
 * Custom-domain verification sweep (claude.md §2A). Runs on Vercel Cron (and is
 * also triggered by the dashboard "check now" button). Polls Vercel for each toy
 * with a pending/verifying domain and advances it to verified or error — never a
 * dead end.
 */
export async function verifyPendingDomains(): Promise<{ checked: number }> {
  const toys = await prisma.toy.findMany({
    where: {
      customDomain: { not: null },
      domainStatus: { in: ["pending", "verifying"] },
    },
    select: { id: true, customDomain: true },
  });

  for (const toy of toys) {
    if (!toy.customDomain) continue;
    const result = await getDomainStatus(toy.customDomain);
    await prisma.toy.update({
      where: { id: toy.id },
      data: {
        domainStatus: result.status,
        ...(result.dnsTarget ? { domainDnsTarget: result.dnsTarget } : {}),
      },
    });
  }

  log.info("verifyPendingDomains swept", { checked: toys.length });
  return { checked: toys.length };
}
