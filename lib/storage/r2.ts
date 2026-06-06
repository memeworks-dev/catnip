import { S3Client } from "@aws-sdk/client-s3";
import { NotImplementedError } from "@/lib/errors";
import { requireEnv } from "@/lib/env";

/**
 * Cloudflare R2 storage (claude.md §5, §13). S3-compatible, no egress fees;
 * holds generated images and share cards. Assets are served behind SIGNED URLs
 * — raw provider URLs are never exposed (§13).
 *
 * Lazily constructed so the app boots without R2 credentials.
 */
let client: S3Client | null = null;

export function getR2(): S3Client {
  if (!client) {
    const accountId = requireEnv("R2_ACCOUNT_ID");
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return client;
}

export function getBucket(): string {
  return requireEnv("R2_BUCKET");
}

export interface PutObjectInput {
  key: string;
  body: Uint8Array;
  contentType: string;
}

/** Upload an object to R2. TODO: PutObjectCommand via getR2(). */
export async function putObject(_input: PutObjectInput): Promise<void> {
  throw new NotImplementedError("r2.putObject");
}

/** Presign a time-limited GET URL (§13). TODO: getSignedUrl + GetObjectCommand. */
export async function signedGetUrl(
  _key: string,
  _expiresInSeconds = 3600,
): Promise<string> {
  throw new NotImplementedError("r2.signedGetUrl");
}

/** Delete an object (used by the retention/deletion job, §14). */
export async function deleteObject(_key: string): Promise<void> {
  throw new NotImplementedError("r2.deleteObject");
}
