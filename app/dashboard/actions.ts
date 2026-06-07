"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth/clerk";
import { uniqueSlug } from "@/lib/toy/slug";
import { pricing } from "@/lib/env";
import { isRedisConfigured } from "@/lib/redis";
import { setToyKilled } from "@/lib/metering/kill-switch";
import {
  addDomain,
  getDomainStatus,
  removeDomain,
  normalizeDomain,
  isValidDomain,
  isPlatformDomain,
  isDomainsConfigured,
  serializeRecords,
  VercelDomainError,
} from "@/lib/domains";
import { log } from "@/lib/logger";

/**
 * Dashboard mutations (claude.md §4B). TENANT ISOLATION (hard rule #8): every
 * action resolves the owner and scopes the toy by ownerId — an owner can only
 * ever touch their own toys.
 */

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function num(form: FormData, key: string, fallback: number): number {
  const raw = String(form.get(key) ?? "").trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) && raw !== "" ? parsed : fallback;
}

/** Build a brand_config JSON object from the onboarding/edit form. */
function brandFromForm(form: FormData) {
  // Use null (not undefined) for omitted fields — undefined isn't valid JSON.
  // parseBrandConfig() fills any null/missing field with the platform default.
  return {
    logoUrl: str(form, "logoUrl") || null,
    brandName: str(form, "brandName") || null,
    brandUrl: str(form, "brandUrl") || null,
    promptStyle: str(form, "promptStyle") || null,
    colors: {
      primary: str(form, "colorPrimary") || "#7C3AED",
      background: str(form, "colorBackground") || "#FFFFFF",
      text: str(form, "colorText") || "#0A0A0A",
      accent: str(form, "colorAccent") || "#F59E0B",
    },
    copy: {
      headline: str(form, "copyHeadline") || null,
      subhead: str(form, "copySubhead") || null,
      cta: str(form, "copyCta") || null,
    },
  };
}

/** Resolve a toy that belongs to the current owner, or 404. */
async function ownedToy(toyId: string, ownerId: string) {
  const toy = await prisma.toy.findFirst({ where: { id: toyId, ownerId } });
  if (!toy) notFound();
  return toy;
}

export async function createToy(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const name = str(form, "name") || "My Meme Booth";

  const toy = await prisma.toy.create({
    data: {
      ownerId: owner.ownerId,
      name,
      slug: await uniqueSlug(name),
      templateId: "meme-booth",
      status: "draft",
      brandConfig: brandFromForm(form),
      perVisitorQuota: Math.max(
        1,
        Math.round(num(form, "perVisitorQuota", pricing.defaultPerVisitorQuota)),
      ),
      spendCapUsd: Math.max(0, num(form, "spendCapUsd", 25)),
    },
  });

  redirect(`/dashboard/toys/${toy.id}`);
}

export async function updateToy(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const toyId = str(form, "toyId");
  const toy = await ownedToy(toyId, owner.ownerId);

  await prisma.toy.update({
    where: { id: toy.id },
    data: {
      name: str(form, "name") || toy.name,
      brandConfig: brandFromForm(form),
      perVisitorQuota: Math.max(
        1,
        Math.round(num(form, "perVisitorQuota", toy.perVisitorQuota)),
      ),
      spendCapUsd: Math.max(0, num(form, "spendCapUsd", Number(toy.spendCapUsd))),
    },
  });

  revalidatePath(`/dashboard/toys/${toy.id}`);
}

export async function publishToy(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const toy = await ownedToy(str(form, "toyId"), owner.ownerId);
  await prisma.toy.update({ where: { id: toy.id }, data: { status: "live" } });
  if (isRedisConfigured()) await setToyKilled(toy.id, false);
  revalidatePath(`/dashboard/toys/${toy.id}`);
}

export async function pauseToy(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const toy = await ownedToy(str(form, "toyId"), owner.ownerId);
  await prisma.toy.update({ where: { id: toy.id }, data: { status: "paused" } });
  revalidatePath(`/dashboard/toys/${toy.id}`);
}

export async function resumeToy(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const toy = await ownedToy(str(form, "toyId"), owner.ownerId);
  await prisma.toy.update({ where: { id: toy.id }, data: { status: "live" } });
  if (isRedisConfigured()) await setToyKilled(toy.id, false);
  revalidatePath(`/dashboard/toys/${toy.id}`);
}

export async function killToy(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const toy = await ownedToy(str(form, "toyId"), owner.ownerId);
  await prisma.toy.update({ where: { id: toy.id }, data: { status: "killed" } });
  // Instant cache flag so generation stops immediately (§7), best-effort.
  if (isRedisConfigured()) await setToyKilled(toy.id, true);
  revalidatePath(`/dashboard/toys/${toy.id}`);
}

// ---------------------------------------------------------------------------
// Custom domains (claude.md §2A). One domain → one toy (enforced by the unique
// constraint + a pre-check); ownership is enforced via ownedToy(). The toy keeps
// serving on its catnip.io slug until the domain is verified, so the owner is
// never blocked.
// ---------------------------------------------------------------------------

export interface DomainActionState {
  ok: boolean;
  error?: string;
}

/**
 * Attach an owner-supplied domain to a toy: add it to the Vercel project, then
 * store it with the returned DNS record and domain_status. Returns a friendly
 * error (for useActionState) instead of throwing, so the dashboard can surface it
 * inline — never a dead end (§2A).
 */
export async function addCustomDomain(
  _prev: DomainActionState,
  form: FormData,
): Promise<DomainActionState> {
  const owner = await requireOwner();
  const toy = await ownedToy(str(form, "toyId"), owner.ownerId);

  if (!isDomainsConfigured()) {
    return {
      ok: false,
      error: "Custom domains aren’t configured yet (set VERCEL_API_TOKEN and VERCEL_PROJECT_ID).",
    };
  }

  const domain = normalizeDomain(str(form, "domain"));
  if (!domain || !isValidDomain(domain)) {
    return { ok: false, error: "Enter a valid domain, e.g. meme.yourbrand.com" };
  }
  if (isPlatformDomain(domain)) {
    return { ok: false, error: "That’s a Catnip domain — enter a domain you own." };
  }

  // One domain → one toy. Pre-check across all toys (the unique constraint is the
  // backstop). Re-adding the same domain to the same toy is idempotent.
  const existing = await prisma.toy.findFirst({
    where: { customDomain: domain },
    select: { id: true },
  });
  if (existing && existing.id !== toy.id) {
    return { ok: false, error: "That domain is already attached to another toy." };
  }

  try {
    const result = await addDomain(domain);
    await prisma.toy.update({
      where: { id: toy.id },
      data: {
        customDomain: domain,
        domainStatus: result.status,
        domainDnsTarget: serializeRecords(result.records),
      },
    });
    revalidatePath(`/dashboard/toys/${toy.id}`);
    return { ok: true };
  } catch (error) {
    // Unique-constraint race (P2002) → friendly message; otherwise surface the
    // Vercel error message.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2002"
    ) {
      return { ok: false, error: "That domain is already attached to another toy." };
    }
    const message =
      error instanceof VercelDomainError
        ? error.message
        : "We couldn’t add this domain. Please try again.";
    log.error("addCustomDomain failed", {
      toyId: toy.id,
      domain,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: message };
  }
}

/** Re-poll Vercel for the toy's domain status ("check now" + cron, §2A). */
export async function checkCustomDomain(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const toy = await ownedToy(str(form, "toyId"), owner.ownerId);
  if (!toy.customDomain || !isDomainsConfigured()) return;

  try {
    const result = await getDomainStatus(toy.customDomain);
    await prisma.toy.update({
      where: { id: toy.id },
      data: {
        domainStatus: result.status,
        ...(result.records.length
          ? { domainDnsTarget: serializeRecords(result.records) }
          : {}),
      },
    });
  } catch (error) {
    // Transient — leave the toy as-is so the owner keeps the record + a retry.
    log.warn("checkCustomDomain failed", {
      toyId: toy.id,
      domain: toy.customDomain,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  revalidatePath(`/dashboard/toys/${toy.id}`);
}

/** Detach the domain from the Vercel project and clear the toy's domain fields. */
export async function removeCustomDomain(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const toy = await ownedToy(str(form, "toyId"), owner.ownerId);
  if (!toy.customDomain) return;

  // Best-effort detach from Vercel; clear our fields regardless so the owner is
  // never stuck with a domain they can't remove.
  if (isDomainsConfigured()) {
    try {
      await removeDomain(toy.customDomain);
    } catch (error) {
      log.warn("removeDomain (Vercel) failed; clearing locally", {
        toyId: toy.id,
        domain: toy.customDomain,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await prisma.toy.update({
    where: { id: toy.id },
    data: { customDomain: null, domainStatus: "none", domainDnsTarget: null },
  });
  revalidatePath(`/dashboard/toys/${toy.id}`);
}
