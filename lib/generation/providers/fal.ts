import { optionalEnv } from "@/lib/env";
import type {
  GenerateImageInput,
  GenerateImageResult,
  ImageProvider,
} from "@/lib/generation/types";

/**
 * Fallback generation provider: fal.ai / Imagen (claude.md §5). Used when the
 * primary provider is down or unconfigured. Same interface as nano banana so the
 * dispatcher swaps without touching toy code (hard rule #2). Implemented over the
 * fal REST API (no SDK needed).
 */

// TODO: use an image-to-image model for self-insert and confirm the model id.
const MODEL = "fal-ai/flux/schnell";
// Representative cost per image, in USD. TODO: confirm against live pricing (§1).
const COST_USD = 0.05;

interface FalResponse {
  images?: Array<{ url: string; content_type?: string }>;
}

export const falProvider: ImageProvider = {
  id: "fal",

  estimateCostUsd(_input: GenerateImageInput): number {
    return COST_USD;
  },

  async generate(input: GenerateImageInput): Promise<GenerateImageResult> {
    const key = optionalEnv("FAL_KEY");
    if (!key) {
      throw new Error("fal: FAL_KEY not configured");
    }

    const res = await fetch(`https://fal.run/${MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: input.prompt, image_size: "square_hd" }),
    });
    if (!res.ok) {
      throw new Error(`fal: HTTP ${res.status}`);
    }

    const data = (await res.json()) as FalResponse;
    const image = data.images?.[0];
    if (!image?.url) {
      throw new Error("fal: no image returned");
    }

    const imgRes = await fetch(image.url);
    if (!imgRes.ok) {
      throw new Error(`fal: fetch image HTTP ${imgRes.status}`);
    }

    return {
      imageBytes: new Uint8Array(await imgRes.arrayBuffer()),
      mimeType:
        image.content_type ??
        imgRes.headers.get("content-type") ??
        "image/png",
      model: MODEL,
      costUsd: COST_USD,
    };
  },
};
