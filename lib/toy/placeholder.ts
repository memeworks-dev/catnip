/**
 * Placeholder "generated meme" image (claude.md §16 sequencing note: generation
 * is stubbed in this phase). Produces a self-contained SVG data URI — no network
 * — themed with the toy's brand colours, the user's caption, brand attribution,
 * and the "Made with Catnip" watermark, so the result screen previews the real
 * share card (§4, §9) without a model call.
 *
 * Replace with the real generateImage() + Vercel OG share card in Phase 2.
 */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface PlaceholderMemeOptions {
  /** User caption / name (may be empty). */
  caption: string;
  /** Brand attribution text. */
  brandName: string;
  primary: string;
  accent: string;
  text: string;
}

export function buildPlaceholderMeme(opts: PlaceholderMemeOptions): string {
  const caption = escapeXml(opts.caption.slice(0, 40));
  const brandName = escapeXml(opts.brandName.slice(0, 40));
  const size = 1080;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${opts.primary}"/>
      <stop offset="100%" stop-color="${opts.accent}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <circle cx="${size / 2}" cy="430" r="220" fill="#ffffff" fill-opacity="0.16"/>
  <text x="50%" y="430" text-anchor="middle" dominant-baseline="central" font-size="200">🐈</text>
  <text x="50%" y="700" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-size="58" font-weight="700" opacity="0.95">PREVIEW MEME</text>
  ${
    caption
      ? `<rect x="90" y="800" width="${size - 180}" height="140" rx="24" fill="#000000" fill-opacity="0.55"/>
  <text x="50%" y="870" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="system-ui, sans-serif" font-size="72" font-weight="800">${caption}</text>`
      : ""
  }
  <text x="60" y="${size - 50}" fill="#ffffff" font-family="system-ui, sans-serif" font-size="34" font-weight="600" opacity="0.9">${brandName}</text>
  <text x="${size - 60}" y="${size - 50}" text-anchor="end" fill="#ffffff" font-family="system-ui, sans-serif" font-size="30" opacity="0.85">Made with Catnip 🐈</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
