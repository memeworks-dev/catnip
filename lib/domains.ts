import { optionalEnv, requireEnv } from "@/lib/env";
import { log } from "@/lib/logger";

/**
 * Custom domains via the Vercel Domains API (claude.md §2A). A custom domain is
 * just another route into the same dynamically rendered toy (multi-tenant), not
 * a separate deployment. Uses VERCEL_API_TOKEN / VERCEL_TEAM_ID / VERCEL_PROJECT_ID.
 *
 * All functions are defensive: API/network failures return an `error` status (or
 * are swallowed for removal) so the dashboard always shows a graceful state with
 * the DNS record and a retry — never a dead end (§2A).
 */

const API = "https://api.vercel.com";

export type DomainStatus = "pending" | "verifying" | "verified" | "error";

export interface DnsRecord {
  type: "A" | "CNAME";
  /** Host/name to set at the registrar ("@" for apex, the label for a subdomain). */
  name: string;
  value: string;
}

export interface DomainResult {
  status: DomainStatus;
  /** The DNS value the owner must point at (cname.vercel-dns.com or the apex A IP). */
  dnsTarget?: string;
  error?: string;
}

export function isVercelConfigured(): boolean {
  return Boolean(optionalEnv("VERCEL_API_TOKEN") && optionalEnv("VERCEL_PROJECT_ID"));
}

/** Apex (brand.com) vs subdomain (meme.brand.com). Heuristic; Vercel is authoritative. */
export function isApexDomain(domain: string): boolean {
  return domain.split(".").length <= 2;
}

/**
 * The DNS record the owner must create (§2A step 3): a CNAME → cname.vercel-dns.com
 * for a subdomain, or an A record → Vercel's apex IP for an apex domain.
 */
export function dnsRecordFor(domain: string): DnsRecord {
  if (isApexDomain(domain)) {
    return { type: "A", name: "@", value: "76.76.21.21" };
  }
  return {
    type: "CNAME",
    name: domain.slice(0, domain.indexOf(".")),
    value: "cname.vercel-dns.com",
  };
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${requireEnv("VERCEL_API_TOKEN")}`,
    "Content-Type": "application/json",
  };
}

function withTeam(path: string): string {
  const team = optionalEnv("VERCEL_TEAM_ID");
  return `${API}${path}${team ? `?teamId=${team}` : ""}`;
}

function projectId(): string {
  return requireEnv("VERCEL_PROJECT_ID");
}

function errorMessage(data: unknown, fallback: string): string {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    data.error &&
    typeof data.error === "object" &&
    "message" in data.error &&
    typeof data.error.message === "string"
  ) {
    return data.error.message;
  }
  return fallback;
}

/** Step 2 — add the domain to the Vercel project. */
export async function addDomain(domain: string): Promise<DomainResult> {
  const dnsTarget = dnsRecordFor(domain).value;
  try {
    const res = await fetch(withTeam(`/v10/projects/${projectId()}/domains`), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name: domain }),
    });
    const data = (await res.json().catch(() => ({}))) as { verified?: boolean };
    if (!res.ok) {
      return {
        status: "error",
        dnsTarget,
        error: errorMessage(data, `Vercel returned ${res.status}`),
      };
    }
    return { status: data.verified ? "verified" : "pending", dnsTarget };
  } catch (error) {
    log.error("vercel addDomain failed", {
      domain,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "error", dnsTarget, error: "Could not reach Vercel" };
  }
}

/** Step 4 — poll the domain's verification + DNS configuration status. */
export async function getDomainStatus(domain: string): Promise<DomainResult> {
  const dnsTarget = dnsRecordFor(domain).value;
  try {
    const [domRes, cfgRes] = await Promise.all([
      fetch(withTeam(`/v9/projects/${projectId()}/domains/${domain}`), {
        headers: headers(),
      }),
      fetch(withTeam(`/v6/domains/${domain}/config`), { headers: headers() }),
    ]);
    const dom = (await domRes.json().catch(() => ({}))) as { verified?: boolean };
    const cfg = (await cfgRes.json().catch(() => ({}))) as {
      misconfigured?: boolean;
    };
    if (!domRes.ok) {
      return { status: "error", dnsTarget, error: errorMessage(dom, `Vercel returned ${domRes.status}`) };
    }
    const verified = dom.verified === true;
    const misconfigured = cfg.misconfigured === true;
    // verified + DNS correct => done; DNS missing => still pending; otherwise
    // DNS seen but SSL/verification still settling => verifying.
    const status: DomainStatus = verified && !misconfigured
      ? "verified"
      : misconfigured
        ? "pending"
        : "verifying";
    return { status, dnsTarget };
  } catch (error) {
    log.error("vercel getDomainStatus failed", {
      domain,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "error", dnsTarget, error: "Could not reach Vercel" };
  }
}

/** Detach a domain from the Vercel project (§2A — removal). Best-effort. */
export async function removeDomain(domain: string): Promise<void> {
  try {
    await fetch(withTeam(`/v10/projects/${projectId()}/domains/${domain}`), {
      method: "DELETE",
      headers: headers(),
    });
  } catch (error) {
    log.warn("vercel removeDomain failed (non-fatal)", {
      domain,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
