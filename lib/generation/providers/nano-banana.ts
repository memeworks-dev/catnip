import { GoogleGenerativeAI } from "@google/generative-ai";
import { optionalEnv } from "@/lib/env";
import type {
  GenerateImageInput,
  GenerateImageResult,
  ImageProvider,
} from "@/lib/generation/types";

/**
 * Primary generation provider: Google nano banana (Gemini image) (claude.md §5).
 * We hold ~$20k of credits here, so this is the default. Never called from a
 * route — only via the generateImage() dispatcher (hard rule #2).
 */

// "Nano banana" is Gemini's image model. TODO: confirm the GA model id.
const MODEL = "gemini-2.5-flash-image";
// Representative cost per generated image, in USD. TODO: confirm against live
// pricing — the whole business depends on this being exact (§1).
const COST_USD = 0.039;

export const nanoBananaProvider: ImageProvider = {
  id: "nano_banana",

  estimateCostUsd(_input: GenerateImageInput): number {
    return COST_USD;
  },

  async generate(input: GenerateImageInput): Promise<GenerateImageResult> {
    const apiKey = optionalEnv("GEMINI_API_KEY");
    if (!apiKey) {
      // Thrown so the dispatcher falls back to the next provider.
      throw new Error("nano_banana: GEMINI_API_KEY not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const parts: Array<
      { text: string } | { inlineData: { data: string; mimeType: string } }
    > = [{ text: input.prompt }];
    if (input.imageBytes && input.imageMimeType) {
      // Self-insert: pass the source photo as inline data (§9).
      parts.push({
        inlineData: {
          data: Buffer.from(input.imageBytes).toString("base64"),
          mimeType: input.imageMimeType,
        },
      });
    }

    const res = await model.generateContent(parts);
    const candidate = res.response.candidates?.[0];
    const imagePart = candidate?.content.parts.find((p) => p.inlineData);
    if (!imagePart?.inlineData) {
      throw new Error("nano_banana: no image returned");
    }

    return {
      imageBytes: new Uint8Array(
        Buffer.from(imagePart.inlineData.data, "base64"),
      ),
      mimeType: imagePart.inlineData.mimeType || "image/png",
      model: MODEL,
      costUsd: COST_USD,
    };
  },
};
