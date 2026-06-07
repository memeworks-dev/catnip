import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { appConfig } from "@/lib/env";
import { GracefulState } from "@/components/graceful-state";
import { MemeBooth } from "@/components/toy/meme-booth";
import { parseBrandConfig } from "@/lib/toy/brand";
import { resolveToyByRouteKey } from "@/lib/toy/resolve";

// Toys render dynamically from their DB row (claude.md §2, hard rule #7) — never
// statically prerendered.
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Shared links carry utm_run; set the share card (Vercel OG, §9) as the
 * og:image so social previews show the meme.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const runId = firstParam(sp.utm_run);

  const toy = await resolveToyByRouteKey(slug);
  const brand = toy ? parseBrandConfig(toy.brandConfig, toy.name) : null;
  const title = brand?.copy.headline ?? toy?.name ?? "Catnip";
  const description = brand?.copy.subhead ?? "Make your meme with Catnip.";

  const images = runId ? [`${appConfig.appUrl}/api/og/${runId}`] : [];

  return {
    title,
    description,
    openGraph: { title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

/**
 * Public toy route: catnip.io/t/[slug] (§2, §4A). Strangers touch this. One app
 * serves every toy: resolve the Toy from the route key and either render its meme
 * booth from brand_config or show a graceful state.
 *
 * The route key is a slug for catnip.io/t/[slug] and *.catnip.io, or a verified
 * custom-domain host when the proxy rewrites one here (§2A) — same renderer, same
 * metering, quota, moderation, share, and analytics. Every failure path is a
 * graceful branded state, never a raw error (§12, hard rule #5).
 */
export default async function ToyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const toy = await resolveToyByRouteKey(slug);
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
      returnUtmSource={firstParam(sp.utm_source)}
    />
  );
}
