import { NotImplementedError } from "@/lib/errors";

/**
 * Custom domains via the Vercel Domains API (claude.md §2A). A custom domain is
 * just another route into the same dynamically rendered toy (multi-tenant), not
 * a separate deployment. Uses VERCEL_API_TOKEN / VERCEL_TEAM_ID.
 *
 * Flow: addDomain → store domain_status=pending + dns target → owner sets DNS →
 * getDomainStatus polled (Vercel Cron or "check now") → verified → SSL.
 */

export type DomainStatus = "pending" | "verifying" | "verified" | "error";

export interface DomainResult {
  status: DomainStatus;
  /** DNS record to show the owner (CNAME to cname.vercel-dns.com, or A records). */
  dnsTarget?: string;
  error?: string;
}

/** Attach a domain to the Vercel project. TODO: POST v10/projects/:id/domains. */
export async function addDomain(_domain: string): Promise<DomainResult> {
  throw new NotImplementedError("domains.addDomain");
}

/** Poll verification status. TODO: GET the domain + config from Vercel. */
export async function getDomainStatus(_domain: string): Promise<DomainResult> {
  throw new NotImplementedError("domains.getDomainStatus");
}

/** Detach a domain. TODO: DELETE the domain from the Vercel project. */
export async function removeDomain(_domain: string): Promise<void> {
  throw new NotImplementedError("domains.removeDomain");
}
