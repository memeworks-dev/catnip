import { NotImplementedError } from "@/lib/errors";
import type {
  GenerateImageInput,
  GenerateImageResult,
  ImageProvider,
} from "@/lib/generation/types";

/**
 * Primary generation provider: Google nano banana (Gemini image) (claude.md §5).
 * We hold ~$20k of credits here, so this is the default.
 *
 * Client stub — wire with the official SDK when generation is built (Phase 2).
 *   import { GoogleGenerativeAI } from "@google/generative-ai";
 *   const client = new GoogleGenerativeAI(requireEnv("GEMINI_API_KEY"));
 */
export const nanoBananaProvider: ImageProvider = {
  id: "nano_banana",

  estimateCostUsd(_input: GenerateImageInput): number {
    // TODO: return the real projected cost per image for the chosen model.
    // The spend-cap reservation depends on this never under-estimating (§7).
    throw new NotImplementedError("nanoBananaProvider.estimateCostUsd");
  },

  async generate(_input: GenerateImageInput): Promise<GenerateImageResult> {
    // TODO: call Gemini image generation with GEMINI_API_KEY, return bytes +
    // the EXACT model cost in costUsd (§1). Run fully server-side / in the job
    // worker; never expose the key (§13).
    throw new NotImplementedError("nanoBananaProvider.generate");
  },
};
