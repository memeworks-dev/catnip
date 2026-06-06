import { NotImplementedError } from "@/lib/errors";
import type {
  ModerateImageInput,
  ModerationProvider,
  ModerationResult,
} from "@/lib/moderation/types";

/**
 * Default moderation provider: Google Vision SafeSearch + a face age-estimation
 * check (claude.md §5, §8). Reached via REST with GOOGLE_VISION_API_KEY.
 *
 * Client stub. When wiring:
 *  - Map SafeSearch likelihoods (adult/violence/racy) to a reject threshold.
 *  - Add a face age-estimation check; any apparent minor is rejected outright
 *    and the image is NEVER processed or stored (§8 — hard rule, no exceptions).
 */
export const googleVisionProvider: ModerationProvider = {
  id: "google_vision",

  async moderateImage(_input: ModerateImageInput): Promise<ModerationResult> {
    // TODO: POST to the Vision API annotate endpoint (SAFE_SEARCH_DETECTION +
    // FACE_DETECTION) and convert the response to a verdict.
    throw new NotImplementedError("googleVisionProvider.moderateImage");
  },

  async moderateText(_text: string): Promise<ModerationResult> {
    // TODO: moderate free text (Vision/Perspective/LLM classifier).
    throw new NotImplementedError("googleVisionProvider.moderateText");
  },
};
