import { isR2Configured, putObject, signedGetUrl } from "@/lib/storage/r2";

export { isR2Configured } from "@/lib/storage/r2";

/**
 * Store a generated image and return a URL the toy can render.
 *
 * Production: upload to R2 and return a signed GET URL so the raw bucket URL is
 * never exposed (§13). The URL is signed for 24h here; production should instead
 * store the object key and sign on read.
 *
 * Dev (no R2 configured): return an inline data URI so the whole generation
 * pipeline is runnable and testable without storage credentials.
 */
export async function storeGeneratedImage(
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  if (isR2Configured()) {
    await putObject({ key, body: bytes, contentType });
    return signedGetUrl(key, 60 * 60 * 24);
  }
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${contentType};base64,${base64}`;
}
