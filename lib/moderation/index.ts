import { appConfig } from "@/lib/env";
import { log } from "@/lib/logger";
import { googleVisionProvider } from "@/lib/moderation/providers/google-vision";
import type {
  ModerateImageInput,
  ModerationProvider,
  ModerationResult,
} from "@/lib/moderation/types";

export type {
  ModerateImageInput,
  ModerationProvider,
  ModerationResult,
  ModerationStage,
  ModerationVerdict,
} from "@/lib/moderation/types";

const PROVIDERS: Record<string, ModerationProvider> = {
  [googleVisionProvider.id]: googleVisionProvider,
};

export function getModerationProvider(
  id: string = appConfig.moderationProvider,
): ModerationProvider {
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new Error(`Unknown moderation provider: ${id}`);
  }
  return provider;
}

/**
 * FAIL CLOSED (claude.md §8, hard rule #3). If the provider errors, times out,
 * or is not yet wired, we REJECT — never fail open. This means the platform is
 * safe-by-default before the provider is implemented: nothing gets through.
 */
function failClosed(error: unknown, stage: string): ModerationResult {
  log.error("moderation failed — failing closed (reject)", {
    stage,
    error: error instanceof Error ? error.message : String(error),
  });
  return { verdict: "reject", reason: "moderation_unavailable" };
}

/** Input/output image moderation. Caller must log a ModerationLog row. */
export async function moderateImage(
  input: ModerateImageInput,
): Promise<ModerationResult> {
  try {
    return await getModerationProvider().moderateImage(input);
  } catch (error) {
    return failClosed(error, "image");
  }
}

/** Prompt/text moderation (§8). */
export async function moderateText(text: string): Promise<ModerationResult> {
  try {
    return await getModerationProvider().moderateText(text);
  } catch (error) {
    return failClosed(error, "text");
  }
}
