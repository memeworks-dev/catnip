import { ImageResponse } from "next/og";

/**
 * Dynamic share card (claude.md §9, templates/meme-booth.md §4). Rendered with
 * Vercel OG (satori): a 1080x1080 card with the generated meme full-bleed, the
 * owner brand attribution (logo + name, top-left), an optional caption band, and
 * the "Made with Catnip" watermark bottom-right.
 *
 * Watermark is on by default on launch tiers (§9, hard rule #6) — every shared
 * card markets Catnip. The emoji is intentionally omitted to avoid needing a
 * network emoji asset at render time.
 *
 * Used by the OG route (renders on demand) and the worker (renders to bytes →
 * stored in R2, saved as Run.shareCardUrl).
 */

export const SHARE_CARD_SIZE = 1080;

export interface ShareCardParams {
  /** Meme image as a data URI (worker) or remote URL (OG route). */
  memeUrl: string;
  /** Whether memeUrl can be embedded as <img>; otherwise a branded fallback. */
  isRaster: boolean;
  caption?: string;
  brandName?: string | null;
  /** Owner logo (only embedded if it's a raster URL). */
  logoUrl?: string | null;
  /** Watermark on/off (Toy.watermarkEnabled). */
  watermark: boolean;
  primary: string;
  accent: string;
}

export function renderShareCard(p: ShareCardParams): ImageResponse {
  const size = SHARE_CARD_SIZE;
  const showLogo = Boolean(p.logoUrl && isRasterUrl(p.logoUrl));
  const showAttribution = Boolean(p.brandName) || showLogo;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: size,
          height: size,
          fontFamily: "sans-serif",
        }}
      >
        {/* Hero: the generated meme, full-bleed (or a branded fallback). */}
        {p.isRaster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.memeUrl}
            alt=""
            width={size}
            height={size}
            style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: size,
              height: size,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundImage: `linear-gradient(135deg, ${p.primary}, ${p.accent})`,
              color: "#ffffff",
              fontSize: 96,
              fontWeight: 800,
            }}
          >
            {p.caption || "Your meme"}
          </div>
        )}

        {/* Brand attribution, top-left. */}
        {showAttribution ? (
          <div
            style={{
              position: "absolute",
              top: 40,
              left: 40,
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "14px 22px",
              backgroundColor: "rgba(0,0,0,0.45)",
              borderRadius: 18,
            }}
          >
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.logoUrl as string}
                alt=""
                width={56}
                height={56}
                style={{ objectFit: "contain", borderRadius: 10 }}
              />
            ) : null}
            {p.brandName ? (
              <span style={{ color: "#ffffff", fontSize: 34, fontWeight: 700 }}>
                {p.brandName}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Caption band, bottom (raster heroes; the fallback already shows it). */}
        {p.isRaster && p.caption ? (
          <div
            style={{
              position: "absolute",
              bottom: 130,
              left: 0,
              width: size,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                padding: "18px 36px",
                backgroundColor: "rgba(0,0,0,0.55)",
                borderRadius: 28,
                color: "#ffffff",
                fontSize: 64,
                fontWeight: 800,
              }}
            >
              {p.caption}
            </div>
          </div>
        ) : null}

        {/* Watermark, bottom-right (on by default on launch tiers). */}
        {p.watermark ? (
          <div
            style={{
              position: "absolute",
              bottom: 40,
              right: 40,
              display: "flex",
              padding: "10px 20px",
              backgroundColor: "rgba(0,0,0,0.6)",
              borderRadius: 14,
            }}
          >
            <span style={{ color: "#ffffff", fontSize: 30, fontWeight: 600 }}>
              Made with Catnip
            </span>
          </div>
        ) : null}
      </div>
    ),
    { width: size, height: size },
  );
}

function isRasterUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.startsWith("data:")) return /^data:image\/(png|jpe?g|webp)/.test(lower);
  const path = lower.split("?")[0];
  if (path.endsWith(".svg")) return false;
  return /\.(png|jpe?g|webp)$/.test(path) || lower.startsWith("http");
}
