import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@/lib/auth/config";

/**
 * Next 16 proxy (formerly middleware). Two jobs:
 *  - Auth (claude.md §5): when Clerk is configured, protect /dashboard(.*) only —
 *    toys stay public. clerkMiddleware is mounted ONLY when keys exist, so the
 *    app boots and toys work without Clerk in dev.
 *  - Host-based routing (§2, §2A): resolve subdomains / custom domains → a toy.
 *    Pass-through for now (edge-safe; only next/server imports here).
 */
const isDashboard = createRouteMatcher(["/dashboard(.*)"]);

function hostRouting(_request: NextRequest): NextResponse {
  // TODO: map [slug].catnip.io / custom domain → /t/[slug] (§2A).
  return NextResponse.next();
}

export const proxy = isClerkConfigured()
  ? clerkMiddleware(async (auth, request) => {
      if (isDashboard(request)) {
        await auth.protect();
      }
      return hostRouting(request);
    })
  : (request: NextRequest) => hostRouting(request);

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
