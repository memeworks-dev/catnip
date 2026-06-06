/**
 * Share helpers (claude.md §9). UTM tagging + image-type detection for the
 * share card.
 */

/**
 * Whether an image reference can be embedded as a raster <img> by satori. Real
 * provider results are raster (png/jpeg/webp); the dev placeholder is an SVG
 * data URI, which the card renders as a branded fallback panel instead.
 */
export function isRasterImageRef(ref: string): boolean {
  const lower = ref.toLowerCase();
  if (lower.startsWith("data:")) {
    return /^data:image\/(png|jpe?g|webp)/.test(lower);
  }
  const path = lower.split("?")[0];
  if (path.endsWith(".svg")) return false;
  if (/\.(png|jpe?g|webp)$/.test(path)) return true;
  // Unknown remote URL — assume raster (prod results are raster).
  return lower.startsWith("http");
}

/** Build a UTM-tagged toy link for sharing (§9): utm_source=catnip + toy id. */
export function buildShareUrl(
  origin: string,
  slug: string,
  toyId: string,
  runId?: string,
): string {
  const params = new URLSearchParams({
    utm_source: "catnip",
    utm_toy: toyId,
  });
  if (runId) params.set("utm_run", runId);
  return `${origin}/t/${slug}?${params.toString()}`;
}
