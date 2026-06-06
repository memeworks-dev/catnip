import { buildPlaceholderSvg } from "@/lib/toy/placeholder";
import type {
  GenerateImageInput,
  GenerateImageResult,
  ImageProvider,
} from "@/lib/generation/types";

/**
 * Dev-only fallback provider (claude.md §16 sequencing note). Produces a
 * brand-themed placeholder image with NO network call and NO cost, so the full
 * async pipeline (job → worker → storage → poll → result) is runnable before any
 * real provider key is configured. The dispatcher only adds this to the fallback
 * chain outside production.
 */

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const localProvider: ImageProvider = {
  id: "local",

  estimateCostUsd(_input: GenerateImageInput): number {
    return 0;
  },

  async generate(input: GenerateImageInput): Promise<GenerateImageResult> {
    const brand = input.brand ?? {};
    const svg = buildPlaceholderSvg({
      caption: input.caption ?? "",
      brandName: str(brand.brandName) ?? "Catnip",
      primary: str(brand.primary) ?? "#7C3AED",
      accent: str(brand.accent) ?? "#F59E0B",
      text: str(brand.text) ?? "#0A0A0A",
    });

    return {
      imageBytes: new TextEncoder().encode(svg),
      mimeType: "image/svg+xml",
      model: "local-placeholder",
      costUsd: 0,
    };
  },
};
