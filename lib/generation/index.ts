/**
 * Generation entry point (claude.md §5, §17 rule 2). Import generateImage from
 * here; never call a provider SDK directly.
 */

export {
  generateImage,
  estimateCostUsd,
  getProvider,
} from "@/lib/generation/generateImage";

export type {
  GenerateImageInput,
  GenerateImageResult,
  ImageProvider,
} from "@/lib/generation/types";
