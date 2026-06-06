import { prisma } from "@/lib/prisma";
import { parseBrandConfig } from "@/lib/toy/brand";
import { renderShareCard } from "@/lib/share/card";
import { isRasterImageRef } from "@/lib/share/util";

/**
 * Vercel OG route: renders the dynamic share card for a Run (claude.md §9). Used
 * as the og:image for shared links (so social previews show the meme) and as the
 * renderer the worker reuses to store a copy in R2.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { toy: true, job: true },
  });
  if (!run || !run.resultUrl) {
    return new Response("Not found", { status: 404 });
  }

  const brand = parseBrandConfig(run.toy.brandConfig, run.toy.name);
  const caption = (run.job?.input as { name?: string } | null)?.name?.trim();

  return renderShareCard({
    memeUrl: run.resultUrl,
    isRaster: isRasterImageRef(run.resultUrl),
    caption: caption || undefined,
    brandName: brand.brandName ?? run.toy.name,
    logoUrl: brand.logoUrl,
    watermark: run.toy.watermarkEnabled,
    primary: brand.colors.primary,
    accent: brand.colors.accent,
  });
}
