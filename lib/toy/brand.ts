/**
 * Typed view of a Toy's `brand_config` JSON (claude.md §16.6). The owner edits
 * these from the dashboard; the public toy renders from them. Everything has a
 * platform default so a toy is ALWAYS renderable, even with `brandConfig = {}`.
 *
 * `parseBrandConfig` is defensive: `brand_config` is free-form JSON in the DB, so
 * we validate each field and fall back rather than trust the shape.
 */

export interface BrandColors {
  primary: string;
  background: string;
  text: string;
  accent: string;
}

export interface BrandCopy {
  headline: string;
  subhead: string;
  cta: string;
  uploadLabel: string;
  nameLabel: string;
  namePlaceholder: string;
  consent: string;
}

export interface BrandConfig {
  logoUrl: string | null;
  brandName: string | null;
  brandUrl: string | null;
  promptStyle: string;
  motif: string | null;
  colors: BrandColors;
  copy: BrandCopy;
}

const DEFAULT_COLORS: BrandColors = {
  primary: "#7C3AED",
  background: "#FFFFFF",
  text: "#0A0A0A",
  accent: "#F59E0B",
};

const DEFAULT_PROMPT_STYLE =
  "bold, vibrant, playful internet-meme illustration, thick outlines, high contrast";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/** Accept only `#rgb` / `#rrggbb` to keep brand colours safe to inline as CSS. */
function color(value: unknown, fallback: string): string {
  const s = str(value);
  return s && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : fallback;
}

/**
 * Parse a Toy.brandConfig into a fully-populated BrandConfig.
 * @param raw the JSON value from the DB
 * @param toyName used to derive friendly copy defaults
 */
export function parseBrandConfig(raw: unknown, toyName: string): BrandConfig {
  const cfg = isRecord(raw) ? raw : {};
  const colorsRaw = isRecord(cfg.colors) ? cfg.colors : {};
  const copyRaw = isRecord(cfg.copy) ? cfg.copy : {};

  const colors: BrandColors = {
    primary: color(colorsRaw.primary, DEFAULT_COLORS.primary),
    background: color(colorsRaw.background, DEFAULT_COLORS.background),
    text: color(colorsRaw.text, DEFAULT_COLORS.text),
    accent: color(colorsRaw.accent, DEFAULT_COLORS.accent),
  };

  const copy: BrandCopy = {
    headline: str(copyRaw.headline) ?? toyName,
    subhead:
      str(copyRaw.subhead) ??
      "Upload a photo and get cooked into a one-of-a-kind meme.",
    cta: str(copyRaw.cta) ?? "Make my meme",
    uploadLabel: str(copyRaw.uploadLabel) ?? "Upload your photo",
    nameLabel: str(copyRaw.nameLabel) ?? "Your name (optional)",
    namePlaceholder: str(copyRaw.namePlaceholder) ?? "e.g. Alex",
    consent:
      str(copyRaw.consent) ??
      "I agree to my photo being processed to create my meme.",
  };

  return {
    logoUrl: str(cfg.logoUrl) ?? null,
    brandName: str(cfg.brandName) ?? null,
    brandUrl: str(cfg.brandUrl) ?? null,
    promptStyle: str(cfg.promptStyle) ?? DEFAULT_PROMPT_STYLE,
    motif: str(cfg.motif) ?? null,
    colors,
    copy,
  };
}
