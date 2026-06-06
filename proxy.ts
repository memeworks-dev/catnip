import { NextResponse, type NextRequest } from "next/server";

/**
 * Host-based routing (claude.md §2, §2A). In Next.js 16 this is the `proxy`
 * convention (formerly `middleware`). Reads the incoming `Host` header and
 * (when built) resolves the Toy for:
 *   - `[slug].catnip.io`  → rewrite to /t/[slug]
 *   - a verified custom domain (e.g. meme.theirbrand.com) → its Toy
 *   - apex `catnip.io` / `www` and `/dashboard` → serve normally
 *
 * Scaffold: pass-through. Keep this edge-safe — only import next/server here, no
 * DB or Node-only SDKs (resolution happens via a cached lookup when built).
 */
export function proxy(_request: NextRequest) {
  // TODO: const host = _request.headers.get("host");
  // map subdomain / custom domain → toy slug, then NextResponse.rewrite(...).
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
