import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GracefulState } from "@/components/graceful-state";
import { MemeBooth } from "@/components/toy/meme-booth";
import { parseBrandConfig } from "@/lib/toy/brand";

// Toys render dynamically from their DB row (claude.md §2, hard rule #7) — never
// statically prerendered.
export const dynamic = "force-dynamic";

/**
 * Public toy route: catnip.io/t/[slug] (§2, §4A). Strangers touch this. One app
 * serves every toy: look up the Toy by slug, and either render its meme booth
 * from brand_config or show a graceful state.
 *
 * Also reached via [slug].catnip.io and verified custom domains through the
 * host-based proxy (§2A). Every failure path is a graceful branded state, never a
 * raw error (§12, hard rule #5).
 */
export default async function ToyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const toy = await prisma.toy.findUnique({ where: { slug } });
  if (!toy) {
    notFound();
  }

  // A toy that isn't live (draft / paused / killed) is not shown to the public.
  if (toy.status !== "live") {
    return <GracefulState kind="not_available" />;
  }

  const brand = parseBrandConfig(toy.brandConfig, toy.name);

  return (
    <MemeBooth
      toy={{ id: toy.id, name: toy.name, slug: toy.slug }}
      brand={brand}
    />
  );
}
