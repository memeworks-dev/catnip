import { optionalEnv } from "@/lib/env";
import { log } from "@/lib/logger";

/**
 * Cloudflare Turnstile bot protection (claude.md §8, §13). Runs on the toy
 * before generation, on top of per-IP rate limiting.
 *
 * FAIL CLOSED: if the secret is missing or verification errors, we return false
 * (deny) — consistent with the safe-by-default posture (§8).
 */
const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: string,
  remoteIp?: string,
): Promise<boolean> {
  const secret = optionalEnv("TURNSTILE_SECRET_KEY");
  if (!secret || !token) return false; // fail closed

  try {
    const body = new FormData();
    body.append("secret", secret);
    body.append("response", token);
    if (remoteIp) body.append("remoteip", remoteIp);

    const res = await fetch(SITEVERIFY_URL, { method: "POST", body });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    log.error("turnstile verification failed — failing closed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
