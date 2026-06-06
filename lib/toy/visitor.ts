import { cookies, headers } from "next/headers";

/**
 * Stable per-visitor id, stored in an httpOnly cookie. Used to attribute
 * GenerationJobs/Runs and (later) to enforce the per-visitor quota (claude.md
 * §7). Call only from a server action / route handler (it may set a cookie).
 */
const COOKIE = "catnip_vid";

export async function getOrCreateVisitorId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing) return existing;

  const id = crypto.randomUUID();
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return id;
}

/** Best-effort client IP for per-IP rate limiting (§7, §13). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "0.0.0.0";
}
