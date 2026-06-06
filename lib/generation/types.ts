/**
 * Generation provider abstraction (claude.md §5, hard rule #2).
 *
 * Generation is the only real ongoing cost (§1), and models change constantly,
 * so a route must NEVER call a provider SDK directly. Everything goes through
 * {@link ImageProvider} and the `generateImage()` dispatcher.
 */

export interface GenerateImageInput {
  /** Fully-resolved prompt (template generation contract + brand + user input). */
  prompt: string;
  /** Source photo bytes for self-insert toys (claude.md §9). */
  imageBytes?: Uint8Array;
  imageMimeType?: string;
  /** Brand customisation surface from Toy.brandConfig (§16.6). */
  brand?: Record<string, unknown>;
  /** Caption / user name baked into the result (self-insert, §9). */
  caption?: string;
  /** Threaded for tracing (§12). */
  requestId?: string;
}

export interface GenerateImageResult {
  imageBytes: Uint8Array;
  mimeType: string;
  /** Concrete model id used, recorded on Run.model. */
  model: string;
  /**
   * EXACT provider cost in USD. The whole business depends on this being right
   * (§1) — it drives the ledger, the spend cap, and charged_usd = cost * markup.
   */
  costUsd: number;
}

export interface ImageProvider {
  /** Stable id, e.g. "nano_banana" / "fal". Matches IMAGE_PROVIDER. */
  readonly id: string;
  /** Run the generation. Server-side only; never expose keys to the client. */
  generate(input: GenerateImageInput): Promise<GenerateImageResult>;
  /**
   * Projected cost of a run, used by the spend-cap reservation BEFORE we spend
   * (§7 reserve → generate → reconcile). Must not under-estimate.
   */
  estimateCostUsd(input: GenerateImageInput): number;
}
