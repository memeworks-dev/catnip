/**
 * Moderation entry point (claude.md §8, §17 rule 2/3). Import moderateImage /
 * moderateText from here; never call a provider SDK directly. Both fail closed
 * and write a ModerationLog row on every decision.
 */

export {
  moderateImage,
  moderateText,
} from "@/lib/moderation/moderateImage";

export type {
  ModerateImageRequest,
  ModerateTextRequest,
} from "@/lib/moderation/moderateImage";

export type {
  ModerateImageInput,
  ModerationProvider,
  ModerationResult,
  ModerationStage,
  ModerationVerdict,
} from "@/lib/moderation/types";
