import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { optionalEnv, requireEnv } from "@/lib/env";

/**
 * Cloudflare R2 storage (claude.md §5, §13). S3-compatible, no egress fees;
 * holds generated images and share cards. Assets are served behind SIGNED URLs —
 * raw provider/bucket URLs are never exposed (§13).
 *
 * Lazily constructed so the app boots without R2 credentials.
 */
let client: S3Client | null = null;

export function isR2Configured(): boolean {
  return Boolean(
    optionalEnv("R2_ACCOUNT_ID") &&
      optionalEnv("R2_ACCESS_KEY_ID") &&
      optionalEnv("R2_SECRET_ACCESS_KEY") &&
      optionalEnv("R2_BUCKET"),
  );
}

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

export async function putObject(input: PutObjectInput): Promise<void> {
  await getR2().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
}

/** Presign a time-limited GET URL (§13). */
export async function signedGetUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  return getSignedUrl(
    getR2(),
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

/** Delete an object (used by the retention/deletion job, §14). */
export async function deleteObject(key: string): Promise<void> {
  await getR2().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
  );
}
