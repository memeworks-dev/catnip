import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@/lib/auth/config";
import { classifyHost, routeKeyForHost } from "@/lib/host-routing";

/**
 * Next 16 proxy (formerly middleware). Two jobs:
 *  - Auth (claude.md §5): when Clerk is configured, protect /dashboard(.*) only —
 *    toys stay public. clerkMiddleware is mounted ONLY when keys exist, so the
 *    app boots and toys work without Clerk in dev.
 *  - Host-based routing (§2, §2A): map a `*.catnip.io` subdomain or a verified
 *    custom domain onto the toy page. Edge-safe (only next/server + pure helpers
 *    here); the authoritative DB lookup happens in app/t/[slug]/page.tsx.
 */
const isDashboard = createRouteMatcher(["/dashboard(.*)"]);

/**
 * Rewrite a toy-host request onto `/t/[key]`, or return null to leave the app's
 * own host untouched. `/api/*` and Next internals always pass through so a toy
 * served on a subdomain / custom domain can still call its own API routes.
 */
function toyRewrite(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) return null;

  const key = routeKeyForHost(classifyHost(request.headers.get("host")));
  if (!key) return null; // app host → normal routing

  const target = `/t/${key}`;
  if (pathname === target) return null; // already canonical (avoid a no-op rewrite)

  const url = request.nextUrl.clone();
  url.pathname = target;
  return NextResponse.rewrite(url); // preserves the original query string
}

export const proxy = isClerkConfigured()
  ? clerkMiddleware(async (auth, request) => {
      // Toy hosts are public: route them first, before any auth check.
      const rewrite = toyRewrite(request);
      if (rewrite) return rewrite;
      if (isDashboard(request)) await auth.protect();
      return NextResponse.next();
    })
  : (request: NextRequest) => toyRewrite(request) ?? NextResponse.next();

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
