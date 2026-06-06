import { optionalEnv } from "@/lib/env";
import type {
  ModerateImageInput,
  ModerationProvider,
  ModerationResult,
} from "@/lib/moderation/types";

/**
 * Google Vision moderation provider (claude.md §5, §8). Uses SafeSearch
 * likelihoods (adult / violence / racy) plus a face check via the REST API
 * (GOOGLE_VISION_API_KEY). Behind the ModerationProvider interface so the
 * backend can be swapped or strengthened without touching toy code (hard #2).
 *
 * Minor protection (§8, non-negotiable, no "probably fine" path): Google Vision
 * does NOT return an age. So if a face is present and we have no age signal, we
 * REJECT (we cannot rule out a minor). A real age-estimation model must be wired
 * into estimateFaceAges() before adult faces can pass in production.
 */

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";
const MINOR_AGE_THRESHOLD = 18;

const LIKELIHOOD_RANK: Record<string, number> = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
};
const rank = (value?: string): number => LIKELIHOOD_RANK[value ?? "UNKNOWN"] ?? 0;

export interface SafeSearchAnnotation {
  adult?: string;
  violence?: string;
  racy?: string;
  medical?: string;
  spoof?: string;
}

export function isGoogleVisionConfigured(): boolean {
  return Boolean(optionalEnv("GOOGLE_VISION_API_KEY"));
}

/**
 * Pure verdict from a Vision response. Exported so the policy can be tested
 * without calling the API.
 *
 * @param ages estimated ages of detected faces, or `null` when no age signal is
 *   available. `null` with a face present => reject (fail closed on minors, §8).
 */
export function evaluateVision(
  safe: SafeSearchAnnotation,
  faceCount: number,
  ages: number[] | null,
): ModerationResult {
  const categories = { ...safe, faceCount };

  if (rank(safe.adult) >= LIKELIHOOD_RANK.LIKELY) {
    return { verdict: "reject", reason: "nsfw_adult", categories };
  }
  if (rank(safe.racy) >= LIKELIHOOD_RANK.VERY_LIKELY) {
    return { verdict: "reject", reason: "nsfw_racy", categories };
  }
  if (rank(safe.violence) >= LIKELIHOOD_RANK.LIKELY) {
    return { verdict: "reject", reason: "graphic_violence", categories };
  }

  if (faceCount > 0) {
    if (ages === null) {
      // Cannot verify age — no "probably fine" path (§8).
      return { verdict: "reject", reason: "minor_check_unavailable", categories };
    }
    if (ages.some((age) => age < MINOR_AGE_THRESHOLD)) {
      return { verdict: "reject", reason: "apparent_minor", categories };
    }
  }

  return { verdict: "pass", categories };
}

/**
 * Age estimation hook. Google Vision provides no age, so this returns null until
 * a dedicated age-estimation model/service is integrated. Null => faces are
 * rejected by evaluateVision (fail closed, §8).
 * TODO: integrate a real age estimator.
 */
async function estimateFaceAges(
  _imageBytes: Uint8Array,
  _faceCount: number,
): Promise<number[] | null> {
  return null;
}

export const googleVisionProvider: ModerationProvider = {
  id: "google_vision",

  async moderateImage(input: ModerateImageInput): Promise<ModerationResult> {
    const apiKey = optionalEnv("GOOGLE_VISION_API_KEY");
    if (!apiKey) {
      // Thrown so the dispatcher fails closed (reject), never open.
      throw new Error("google_vision: GOOGLE_VISION_API_KEY not configured");
    }

    const body = {
      requests: [
        {
          image: { content: Buffer.from(input.imageBytes).toString("base64") },
          features: [
            { type: "SAFE_SEARCH_DETECTION" },
            { type: "FACE_DETECTION" },
          ],
        },
      ],
    };

    const res = await fetch(`${VISION_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`google_vision: HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      responses?: Array<{
        safeSearchAnnotation?: SafeSearchAnnotation;
        faceAnnotations?: unknown[];
      }>;
    };
    const result = data.responses?.[0] ?? {};
    const safe = result.safeSearchAnnotation ?? {};
    const faceCount = result.faceAnnotations?.length ?? 0;
    const ages =
      faceCount > 0 ? await estimateFaceAges(input.imageBytes, faceCount) : [];

    return evaluateVision(safe, faceCount, ages);
  },

  async moderateText(_text: string): Promise<ModerationResult> {
    // Vision does not classify free text; wire a text classifier here. Until
    // then this throws and the dispatcher fails closed in production (§8).
    throw new Error("google_vision: moderateText not implemented");
  },
};
