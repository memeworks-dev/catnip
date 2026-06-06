import type { BrandConfig } from "@/lib/toy/brand";

/**
 * Build the meme-booth generation prompt from brand config + user name, per the
 * generation contract in templates/meme-booth.md §3.1. The photo is supplied to
 * the provider separately (as image bytes), not in this text.
 */
export function buildMemeBoothPrompt(brand: BrandConfig, name: string): string {
  const caption = name.trim();
  return [
    "Transform the person in the supplied photo into a single, polished, shareable meme image.",
    "Keep them clearly recognisable (same face, hair, skin tone) — this is a self-insert, not a generic character.",
    `Art style: ${brand.promptStyle}.`,
    `Brand palette: primary ${brand.colors.primary}, background ${brand.colors.background}, accent ${brand.colors.accent}.`,
    brand.motif
      ? `Subtly incorporate the brand motif: ${brand.motif}. Do not render any logo.`
      : "Do not render any brand logo.",
    "Composition: one subject, centered, waist-up, looking at camera, with a clear band at the bottom for caption text.",
    caption
      ? `Render this caption in bold meme text: "${caption}".`
      : "Do not add caption text.",
    "Output exactly one image, 1:1 aspect ratio, 1024x1024, safe-for-work.",
    "Hard constraints: no nudity, gore, violence, hate symbols, or drugs; never depict anyone who appears to be a minor; no real public figures other than the supplied subject; no text other than the caption.",
  ].join("\n");
}
