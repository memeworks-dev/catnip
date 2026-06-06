"use server";

import { prisma } from "@/lib/prisma";
import { parseBrandConfig } from "@/lib/toy/brand";
import { buildPlaceholderMeme } from "@/lib/toy/placeholder";

export type GenerateMemeResult =
  | { ok: true; imageUrl: string }
  | { ok: false; reason: "not_available" | "failed" };

export interface GenerateMemeInput {
  slug: string;
  name: string;
}

/**
 * STUBBED generation (claude.md §16 sequencing note). Returns a branded
 * placeholder image so the public toy shell works end to end before the real
 * model is wired.
 *
 * When generation is built, this is where the toy's required Catnip hooks run,
 * in order (§16.7), instead of returning a placeholder:
 *   1. per-visitor quota   2. spend-cap reserve (+ kill switch + rate limit)
 *   3. input moderation (fail closed)   4. enqueue generation job (QStash)
 *   5. output moderation   6. share-card → R2   7. analytics `run`
 *   + reconcile the reservation, write Run + CreditLedger, delete source photo.
 */
export async function generateMemeStub(
  input: GenerateMemeInput,
): Promise<GenerateMemeResult> {
  try {
    // Re-check server-side that the toy exists and is live (defence in depth) —
    // never trust the client about toy status.
    const toy = await prisma.toy.findUnique({ where: { slug: input.slug } });
    if (!toy || toy.status !== "live") {
      return { ok: false, reason: "not_available" };
    }

    const brand = parseBrandConfig(toy.brandConfig, toy.name);

    // Simulate the async job latency so the loading state is visible.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const imageUrl = buildPlaceholderMeme({
      caption: input.name.trim(),
      brandName: brand.brandName ?? toy.name,
      primary: brand.colors.primary,
      accent: brand.colors.accent,
      text: brand.colors.text,
    });

    return { ok: true, imageUrl };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
