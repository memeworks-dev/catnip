import { prisma } from "@/lib/prisma";
import { RESERVED_SUBDOMAINS } from "@/lib/host-routing";

/** URL-safe slug from a toy name. */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "toy";
}

/**
 * A slug unique across all toys (appends a short suffix on collision). Reserved
 * subdomain labels (www, app, …) are treated as taken so a slug can never shadow
 * a platform subdomain in host-based routing (§2A).
 */
export async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate =
      attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (RESERVED_SUBDOMAINS.has(candidate)) continue;
    const existing = await prisma.toy.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  // Extremely unlikely fallback.
  return `${base}-${Date.now().toString(36)}`;
}
