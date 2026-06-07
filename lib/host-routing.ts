import { appConfig } from "@/lib/env";

/**
 * Host-based routing (claude.md §2, §2A). Pure, edge-safe helpers used by the
 * Next proxy (middleware) to map an incoming `Host` header onto a toy:
 *  - `*.catnip.io`            → the toy whose slug is the subdomain label
 *  - a verified custom domain → the toy that owns that domain
 *  - everything else          → the app itself (landing, dashboard, /t, /api)
 *
 * This file must stay free of Node-only / Prisma imports: it runs in the edge
 * runtime. The authoritative toy lookup (DB, "verified" check) happens in the
 * toy page (Node), which the proxy rewrites to — see app/t/[slug]/page.tsx.
 */

/**
 * Subdomain labels that are NOT toys — they belong to the platform. Also used by
 * slug generation so a toy can never claim one of these (lib/toy/slug.ts).
 */
export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "dashboard",
  "assets",
  "static",
  "cdn",
  "mail",
  "email",
  "smtp",
  "ftp",
  "blog",
  "docs",
  "status",
  "staging",
  "dev",
  "vercel",
]);

export type HostRoute =
  | { kind: "app" }
  | { kind: "subdomain"; slug: string }
  | { kind: "custom"; host: string };

/** Lower-cased hostname with any port stripped, or null when absent. */
export function normalizeHost(rawHost: string | null | undefined): string | null {
  if (!rawHost) return null;
  const host = rawHost.split(":")[0]?.trim().toLowerCase();
  return host || null;
}

/**
 * Classify a Host header. `rootDomain` defaults to ROOT_DOMAIN (catnip.io).
 *
 * The custom-domain branch is intentionally optimistic: the proxy can't reach
 * the DB at the edge, so any host that isn't the app or a root-domain subdomain
 * is treated as a candidate custom domain and rewritten to the toy page, which
 * does the authoritative `domain_status = verified` lookup (§2A).
 */
export function classifyHost(
  rawHost: string | null | undefined,
  rootDomain: string = appConfig.rootDomain,
): HostRoute {
  const host = normalizeHost(rawHost);
  if (!host) return { kind: "app" };

  // Local + Vercel-internal hosts always serve the app (landing/dashboard).
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) {
    return { kind: "app" };
  }
  if (host.endsWith(".vercel.app")) return { kind: "app" };

  const root = rootDomain.toLowerCase();
  if (host === root || host === `www.${root}`) return { kind: "app" };

  if (host.endsWith(`.${root}`)) {
    const label = host.slice(0, host.length - root.length - 1);
    // Only a single-label subdomain is a toy; reserved labels stay on the app.
    if (!label || label.includes(".") || RESERVED_SUBDOMAINS.has(label)) {
      return { kind: "app" };
    }
    return { kind: "subdomain", slug: label };
  }

  // Anything else is a candidate custom domain.
  return { kind: "custom", host };
}

/**
 * The internal `/t/[slug]` path a host should be rewritten to. A real slug never
 * contains a dot (see lib/toy/slug.ts), so a dotted key unambiguously signals a
 * custom-domain lookup to the toy page (§2A).
 */
export function routeKeyForHost(route: HostRoute): string | null {
  if (route.kind === "subdomain") return route.slug;
  if (route.kind === "custom") return route.host;
  return null;
}
