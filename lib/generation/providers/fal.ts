import { NotImplementedError } from "@/lib/errors";
import type {
  GenerateImageInput,
  GenerateImageResult,
  ImageProvider,
} from "@/lib/generation/types";

/**
 * Fallback generation provider: fal.ai / Imagen (claude.md §5). Used when the
 * primary provider is down or rate-limited. Behind the SAME interface so the
 * dispatcher can swap without touching toy code (hard rule #2).
 *
 * Client stub — add the SDK (e.g. `@fal-ai/client`) and FAL_KEY when wiring.
 */
export const falProvider: ImageProvider = {
  id: "fal",

  estimateCostUsd(_input: GenerateImageInput): number {
    // TODO: return the real projected cost per image (§7).
    throw new NotImplementedError("falProvider.estimateCostUsd");
  },

  async generate(_input: GenerateImageInput): Promise<GenerateImageResult> {
    // TODO: call fal.ai with FAL_KEY, return bytes + EXACT model cost (§1).
    throw new NotImplementedError("falProvider.generate");
  },
};
