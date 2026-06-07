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

/**
 * Host-based routing (§2, §2A step 5). On the toy landing path "/", map the Host
 * to a toy and rewrite to /t/[slug] so it renders identically (same metering,
 * quota, moderation, share, analytics):
 *   - [slug].catnip.io        → /t/[slug]            (slug is the subdomain)
 *   - a custom domain          → /t/{host}           (the page resolves host→toy)
 * The apex (catnip.io / www), localhost, and *.vercel.app are served normally so
 * the marketing site + dashboard work. Edge-safe: no DB here — the custom-domain
 * lookup happens in the Node page (resolvePublicToy).
 */
function hostRouting(request: NextRequest): NextResponse {
  const url = request.nextUrl;
  if (url.pathname !== "/") return NextResponse.next();

  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const root = (process.env.ROOT_DOMAIN ?? "catnip.io").toLowerCase();

  if (!host || host === "localhost" || host.endsWith(".vercel.app")) {
    return NextResponse.next();
  }

  // *.catnip.io subdomain → the slug is the leftmost label.
  if (host.endsWith(`.${root}`)) {
    const label = host.slice(0, host.length - root.length - 1);
    if (label && label !== "www" && label !== "app") {
      const rewrite = url.clone();
      rewrite.pathname = `/t/${label}`;
      return NextResponse.rewrite(rewrite);
    }
    return NextResponse.next();
  }

  // Apex / marketing host → serve normally.
  if (host === root || host === `www.${root}`) {
    return NextResponse.next();
  }

  // Anything else is a custom domain → resolve by host in the page.
  const rewrite = url.clone();
  rewrite.pathname = `/t/${host}`;
  return NextResponse.rewrite(rewrite);
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
