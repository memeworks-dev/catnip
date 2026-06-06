import { appConfig } from "@/lib/env";
import { log } from "@/lib/logger";
import { nanoBananaProvider } from "@/lib/generation/providers/nano-banana";
import { falProvider } from "@/lib/generation/providers/fal";
import { localProvider } from "@/lib/generation/providers/local";
import type {
  GenerateImageInput,
  GenerateImageResult,
  ImageProvider,
} from "@/lib/generation/types";

/**
 * The single generation interface (claude.md §17 rule 2). Routes and jobs call
 * ONLY generateImage() — never a provider SDK directly. Returns the image bytes
 * and the EXACT cost_usd (§1) so the worker can store the result and reconcile
 * the spend.
 */

/** Provider registry. Add new providers here; never call SDKs from routes. */
const PROVIDERS: Record<string, ImageProvider> = {
  [nanoBananaProvider.id]: nanoBananaProvider,
  [falProvider.id]: falProvider,
  [localProvider.id]: localProvider,
};

export function getProvider(id: string = appConfig.imageProvider): ImageProvider {
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new Error(`Unknown image provider: ${id}`);
  }
  return provider;
}

/**
 * Order tried on failure (§5, §12): the provider chosen by IMAGE_PROVIDER, then
 * the fal fallback. Outside production we also fall back to the local placeholder
 * so the toy works end to end without provider keys.
 */
function providerOrder(): string[] {
  const order = [appConfig.imageProvider, falProvider.id];
  if (process.env.NODE_ENV !== "production") {
    order.push(localProvider.id);
  }
  return [...new Set(order)].filter((id) => PROVIDERS[id]);
}

/** Projected cost for the spend-cap reservation (§7). */
export function estimateCostUsd(input: GenerateImageInput): number {
  return getProvider().estimateCostUsd(input);
}

/**
 * Generate an image through the active provider, falling back to the next on
 * failure. The ONLY entry point routes/jobs may use. Storage, moderation, and
 * ledger writes happen around this call in the worker (jobs/generate.ts).
 */
export async function generateImage(
  input: GenerateImageInput,
): Promise<GenerateImageResult> {
  let lastError: unknown;
  for (const id of providerOrder()) {
    try {
      return await getProvider(id).generate(input);
    } catch (error) {
      lastError = error;
      log.warn("generation provider failed, trying next", {
        requestId: input.requestId,
        provider: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  throw lastError ?? new Error("All generation providers failed");
}
