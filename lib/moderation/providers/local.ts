import type {
  ModerateImageInput,
  ModerationProvider,
  ModerationResult,
} from "@/lib/moderation/types";

/**
 * Dev-only moderation provider. ALLOWS everything so the toy is testable without
 * a moderation key. The dispatcher only selects this OUTSIDE production when no
 * real provider is configured — production never silently allows; an
 * unconfigured provider there throws and we fail closed (§8).
 */
export const localModerationProvider: ModerationProvider = {
  id: "local",

  async moderateImage(_input: ModerateImageInput): Promise<ModerationResult> {
    return { verdict: "pass", reason: "dev_local_allow" };
  },

  async moderateText(_text: string): Promise<ModerationResult> {
    return { verdict: "pass", reason: "dev_local_allow" };
  },
};
