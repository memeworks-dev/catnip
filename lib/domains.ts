import { optionalEnv, requireEnv, appConfig } from "@/lib/env";

/**
 * Custom domains via the Vercel Domains API (claude.md §2A). A custom domain is
 * just another route into the same dynamically rendered toy (multi-tenant), not
 * a separate deployment.
 *
 * Flow: addDomain → store domain_status + DNS record(s) → owner sets DNS →
 * getDomainStatus polled (Vercel Cron or "check now") → verified → Vercel
 * auto-provisions SSL.
 *
 * Config: VERCEL_API_TOKEN, VERCEL_PROJECT_ID (the Catnip project), and
 * optionally VERCEL_TEAM_ID when the project lives under a team.
 */

const VERCEL_API = "https://api.vercel.com";
/** Documented Vercel targets shown to owners (claude.md §2A). */
const VERCEL_CNAME_TARGET = "cname.vercel-dns.com";
const VERCEL_APEX_A_RECORD = "76.76.21.21";

export type DomainStatus = "pending" | "verifying" | "verified" | "error";

/** A DNS record the owner must create at their registrar. */
export interface DnsRecord {
  type: "A" | "CNAME" | "TXT";
  /** Host/name, e.g. "@" for an apex or the subdomain label. */
  name: string;
  value: string;
}

export interface DomainResult {
  status: DomainStatus;
  /** Records to show the owner (CNAME → cname.vercel-dns.com, or A for an apex). */
  records: DnsRecord[];
  error?: string;
}

/** A Vercel Domains API error with the upstream status/code attached. */
export class VercelDomainError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "VercelDomainError";
    this.status = status;
    this.code = code;
  }
}

/** True once the Vercel credentials needed to manage domains are present. */
export function isDomainsConfigured(): boolean {
  return Boolean(optionalEnv("VERCEL_API_TOKEN") && optionalEnv("VERCEL_PROJECT_ID"));
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

/** Strip protocol/path/whitespace/wildcard and lower-case a domain input. */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\s+/g, "")
    .replace(/^\*\./, "")
    .replace(/\.$/, "");
}

/** A conservative FQDN check (labels + a 2+ char alpha TLD). */
export function isValidDomain(domain: string): boolean {
  if (domain.length > 253) return false;
  return /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain);
}

/**
 * Reject the platform's own domains — an owner can't attach catnip.io, a
 * *.catnip.io subdomain, or a *.vercel.app host as a "custom" domain.
 */
export function isPlatformDomain(domain: string, rootDomain = appConfig.rootDomain): boolean {
  const root = rootDomain.toLowerCase();
  return (
    domain === root ||
    domain.endsWith(`.${root}`) ||
    domain.endsWith(".vercel.app") ||
    domain === "localhost" ||
    domain.endsWith(".localhost")
  );
}

// ---------------------------------------------------------------------------
// Vercel REST helpers
// ---------------------------------------------------------------------------

function withTeam(path: string): string {
  const team = optionalEnv("VERCEL_TEAM_ID");
  if (!team) return path;
  return `${path}${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(team)}`;
}

interface VercelResponse {
  ok: boolean;
  status: number;
  body: unknown;
}

async function vercelFetch(path: string, init?: RequestInit): Promise<VercelResponse> {
  const token = requireEnv("VERCEL_API_TOKEN");
  const res = await fetch(`${VERCEL_API}${withTeam(path)}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // some endpoints (e.g. DELETE) may return an empty body
  }
  return { ok: res.ok, status: res.status, body };
}

/** Shape of the bits of a Vercel project-domain / verification response we read. */
interface VercelProjectDomain {
  name?: string;
  apexName?: string;
  verified?: boolean;
  verification?: Array<{ type?: string; domain?: string; value?: string }>;
  error?: { message?: string; code?: string };
}

function asProjectDomain(body: unknown): VercelProjectDomain {
  return (body ?? {}) as VercelProjectDomain;
}

function projectPath(suffix = ""): string {
  const project = requireEnv("VERCEL_PROJECT_ID");
  return `/v9/projects/${encodeURIComponent(project)}/domains${suffix}`;
}

// ---------------------------------------------------------------------------
// DNS record computation + persistence
// ---------------------------------------------------------------------------

/**
 * The DNS record(s) the owner must set: a CNAME for a subdomain, an A record for
 * an apex (claude.md §2A). Any Vercel ownership-verification challenge (a TXT,
 * present only when the domain is already used elsewhere on Vercel) is appended.
 */
function recordsFor(domain: VercelProjectDomain, fallbackName: string): DnsRecord[] {
  const name = domain.name ?? fallbackName;
  const apexName = domain.apexName ?? guessApex(name);
  const records: DnsRecord[] = [];

  if (name === apexName) {
    records.push({ type: "A", name: "@", value: VERCEL_APEX_A_RECORD });
  } else {
    const sub = name.endsWith(`.${apexName}`)
      ? name.slice(0, name.length - apexName.length - 1)
      : name.split(".")[0];
    records.push({ type: "CNAME", name: sub, value: VERCEL_CNAME_TARGET });
  }

  for (const v of domain.verification ?? []) {
    const type = v.type?.toUpperCase();
    if ((type === "TXT" || type === "CNAME" || type === "A") && v.domain && v.value) {
      records.push({ type, name: v.domain, value: v.value });
    }
  }
  return records;
}

/** Fallback apex guess when Vercel didn't return one (2-label heuristic). */
function guessApex(name: string): string {
  const parts = name.split(".");
  return parts.length <= 2 ? name : parts.slice(-2).join(".");
}

/** Serialise records for the Toy.domainDnsTarget column. */
export function serializeRecords(records: DnsRecord[]): string {
  return JSON.stringify(records);
}

/** Parse Toy.domainDnsTarget back into records (tolerant of a legacy plain string). */
export function parseRecords(stored: string | null | undefined): DnsRecord[] {
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed)) return parsed as DnsRecord[];
  } catch {
    return [{ type: "CNAME", name: "@", value: stored }];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Public API: add / status / remove
// ---------------------------------------------------------------------------

/** Attach a domain to the Vercel project and return the DNS record to set. */
export async function addDomain(domain: string): Promise<DomainResult> {
  const { ok, status, body } = await vercelFetch(
    `/v10/projects/${encodeURIComponent(requireEnv("VERCEL_PROJECT_ID"))}/domains`,
    { method: "POST", body: JSON.stringify({ name: domain }) },
  );

  if (!ok) {
    // Already attached (to this project) — fall through to a status read so the
    // owner still gets the DNS record and current state.
    if (status === 409) return getDomainStatus(domain);
    const err = asProjectDomain(body).error;
    throw new VercelDomainError(
      err?.message ?? `Vercel could not add this domain (HTTP ${status}).`,
      status,
      err?.code,
    );
  }

  const parsed = asProjectDomain(body);
  const records = recordsFor(parsed, domain);
  // Freshly added: the owner still has to point DNS, so start at pending.
  return { status: parsed.verified ? "verifying" : "pending", records };
}

/** Poll Vercel for the current verification + DNS-configuration state. */
export async function getDomainStatus(domain: string): Promise<DomainResult> {
  const dom = await vercelFetch(projectPath(`/${encodeURIComponent(domain)}`), {
    method: "GET",
  });
  if (dom.status === 404) {
    return { status: "error", records: [], error: "Domain is not attached to the project." };
  }
  if (!dom.ok) {
    const err = asProjectDomain(dom.body).error;
    throw new VercelDomainError(
      err?.message ?? `Vercel domain check failed (HTTP ${dom.status}).`,
      dom.status,
      err?.code,
    );
  }

  const parsed = asProjectDomain(dom.body);
  let verified = Boolean(parsed.verified);

  // Nudge ownership verification (no-op once verified). Best-effort.
  if (!verified) {
    const v = await vercelFetch(projectPath(`/${encodeURIComponent(domain)}/verify`), {
      method: "POST",
    }).catch(() => null);
    if (v?.ok && asProjectDomain(v.body).verified) verified = true;
  }

  // Config tells us whether the DNS record actually resolves to Vercel.
  const cfg = await vercelFetch(`/v6/domains/${encodeURIComponent(domain)}/config`, {
    method: "GET",
  }).catch(() => null);
  const misconfigured = cfg?.ok
    ? Boolean((cfg.body as { misconfigured?: boolean } | null)?.misconfigured)
    : true;

  const records = recordsFor(parsed, domain);
  let status: DomainStatus;
  if (verified && !misconfigured) status = "verified";
  else if (!misconfigured) status = "verifying"; // DNS detected, finishing up
  else status = "pending"; // DNS not set / not resolving yet

  return { status, records };
}

/** Detach a domain from the Vercel project (idempotent — 404 is fine). */
export async function removeDomain(domain: string): Promise<void> {
  const { ok, status } = await vercelFetch(projectPath(`/${encodeURIComponent(domain)}`), {
    method: "DELETE",
  });
  if (!ok && status !== 404) {
    throw new VercelDomainError(`Vercel could not remove this domain (HTTP ${status}).`, status);
  }
}
