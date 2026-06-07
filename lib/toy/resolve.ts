import { prisma } from "@/lib/prisma";
import type { Toy } from "@prisma/client";

/**
 * Resolve the toy for a public request (claude.md §2A step 5). The /t/[slug]
 * route param is either a real slug (no dots) or — when the proxy rewrites a
 * custom-domain request — a hostname (has dots). A custom domain only resolves
 * once it's verified, so the toy keeps serving on its catnip.io slug until then.
 */
export async function resolvePublicToy(param: string): Promise<Toy | null> {
  const bySlug = await prisma.toy.findUnique({ where: { slug: param } });
  if (bySlug) return bySlug;

  if (param.includes(".")) {
    return prisma.toy.findFirst({
      where: { customDomain: param.toLowerCase(), domainStatus: "verified" },
    });
  }
  return null;
}
