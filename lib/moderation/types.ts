/**
 * Moderation provider abstraction (claude.md §8, hard rule #2/#3).
 *
 * A public photo-upload AI toy invites misuse, so moderation is a first-class,
 * fail-closed feature. Routes never call a moderation SDK directly — they go
 * through `moderateImage()` / `moderateText()`.
 */

export type ModerationStage = "input" | "output";
export type ModerationVerdict = "pass" | "reject";

export interface ModerateImageInput {
  imageBytes: Uint8Array;
  mimeType: string;
  toyId?: string;
  requestId?: string;
}

export interface ModerationResult {
  verdict: ModerationVerdict;
  /** Human-readable reason, stored on ModerationLog and used for graceful state. */
  reason?: string;
  /** Raw category likelihoods for audit/debug (e.g. SafeSearch buckets). */
  categories?: Record<string, unknown>;
}

export interface ModerationProvider {
  /** Stable id, matches MODERATION_PROVIDER. */
  readonly id: string;
  /**
   * Inspect an image. MUST reject NSFW, graphic violence, and any image that
   * appears to depict a minor (hard rule: no "probably fine" path) — §8.
   */
  moderateImage(input: ModerateImageInput): Promise<ModerationResult>;
  /** Inspect free-text input (e.g. a name/caption) — §8. */
  moderateText(text: string): Promise<ModerationResult>;
}
