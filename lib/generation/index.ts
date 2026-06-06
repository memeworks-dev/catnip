import { appConfig } from "@/lib/env";
import { log } from "@/lib/logger";
import { nanoBananaProvider } from "@/lib/generation/providers/nano-banana";
import { falProvider } from "@/lib/generation/providers/fal";
import type {
  GenerateImageInput,
  GenerateImageResult,
  ImageProvider,
} from "@/lib/generation/types";

export type {
  GenerateImageInput,
  GenerateImageResult,
  ImageProvider,
} from "@/lib/generation/types";

/** Provider registry. Add new providers here, never call SDKs from routes. */
const PROVIDERS: Record<string, ImageProvider> = {
  [nanoBananaProvider.id]: nanoBananaProvider,
  [falProvider.id]: falProvider,
};

/** Order tried when the primary provider fails (§12 retries / fallbacks). */
const FALLBACK_ORDER: string[] = [nanoBananaProvider.id, falProvider.id];

export function getProvider(id: string = appConfig.imageProvider): ImageProvider {
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new Error(`Unknown image provider: ${id}`);
  }
  return provider;
}

/**
 * Project the cost of a run for the spend-cap reservation (§7). Uses the active
 * primary provider's estimate.
 */
export function estimateCostUsd(input: GenerateImageInput): number {
  return getProvider().estimateCostUsd(input);
}

/**
 * Generate an image through the active provider, falling back to the next
 * provider on failure. This is the ONLY entry point routes/jobs may use.
 *
 * Cost reconciliation, moderation, and ledger writes happen around this call in
 * the job worker (see /jobs/generate.ts), not here.
 */
export async function generateImage(
  input: GenerateImageInput,
): Promise<GenerateImageResult> {
  let lastError: unknown;
  for (const id of FALLBACK_ORDER) {
    try {
      return await getProvider(id).generate(input);
    } catch (error) {
      lastError = error;
      log.warn("generation provider failed, trying fallback", {
        requestId: input.requestId,
        provider: id,
      });
    }
  }
  throw lastError ?? new Error("All generation providers failed");
}
