import type { Toy } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Resolve a toy from the `/t/[key]` route key the proxy produces (claude.md §2A).
 *
 * A slug never contains a dot (lib/toy/slug.ts), so a dotted key is a custom-domain
 * host: it resolves only when that domain is `verified`, which is what lets a toy
 * render identically on a custom domain and a *.catnip.io subdomain. A non-dotted
 * key is a slug (catnip.io/t/[slug] and *.catnip.io). One lookup, one renderer.
 */
export async function resolveToyByRouteKey(routeKey: string): Promise<Toy | null> {
  const key = decodeURIComponent(routeKey).trim().toLowerCase().replace(/\.$/, "");
  if (!key) return null;

  if (key.includes(".")) {
    return prisma.toy.findFirst({
      where: { customDomain: key, domainStatus: "verified" },
    });
  }
  return prisma.toy.findUnique({ where: { slug: key } });
}
