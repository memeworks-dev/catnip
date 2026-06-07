"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth/clerk";
import {
  addDomain,
  getDomainStatus,
  removeDomain as vercelRemoveDomain,
  isVercelConfigured,
  dnsRecordFor,
} from "@/lib/domains";

/**
 * Custom-domain actions (claude.md §2A). TENANT ISOLATION (hard rule #8): every
 * action scopes the toy by ownerId. Uniqueness (one domain → one toy) is enforced
 * by the unique customDomain column + an explicit cross-toy check. Failures route
 * back with a message — never a dead end.
 */

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

/** Normalise user input to a bare hostname. */
function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

async function ownedToy(toyId: string, ownerId: string) {
  const toy = await prisma.toy.findFirst({ where: { id: toyId, ownerId } });
  if (!toy) notFound();
  return toy;
}

function back(toyId: string, error?: string): never {
  redirect(
    `/dashboard/toys/${toyId}${error ? `?domainError=${encodeURIComponent(error)}` : ""}`,
  );
}

export async function attachDomain(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const toyId = str(form, "toyId");
  const toy = await ownedToy(toyId, owner.ownerId);

  const domain = normalizeDomain(str(form, "domain"));
  if (!HOSTNAME.test(domain)) {
    back(toy.id, "Enter a valid domain, e.g. meme.yourbrand.com");
  }
  if (!isVercelConfigured()) {
    back(toy.id, "Custom domains aren't configured on this deployment yet");
  }

  // One domain → one toy (§2A).
  const taken = await prisma.toy.findFirst({
    where: { customDomain: domain, NOT: { id: toy.id } },
  });
  if (taken) {
    back(toy.id, "That domain is already attached to another toy");
  }

  const result = await addDomain(domain);
  if (result.status === "error") {
    back(toy.id, result.error ?? "Could not add the domain at Vercel");
  }

  try {
    await prisma.toy.update({
      where: { id: toy.id },
      data: {
        customDomain: domain,
        domainStatus: result.status === "verified" ? "verified" : "pending",
        domainDnsTarget: result.dnsTarget ?? dnsRecordFor(domain).value,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      back(toy.id, "That domain is already attached to another toy");
    }
    throw error;
  }

  redirect(`/dashboard/toys/${toy.id}`);
}

export async function verifyDomain(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const toy = await ownedToy(str(form, "toyId"), owner.ownerId);
  if (!toy.customDomain) back(toy.id);

  const result = await getDomainStatus(toy.customDomain);
  await prisma.toy.update({
    where: { id: toy.id },
    data: {
      domainStatus: result.status,
      domainDnsTarget: result.dnsTarget ?? toy.domainDnsTarget,
    },
  });
  revalidatePath(`/dashboard/toys/${toy.id}`);
}

export async function detachDomain(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const toy = await ownedToy(str(form, "toyId"), owner.ownerId);

  if (toy.customDomain && isVercelConfigured()) {
    await vercelRemoveDomain(toy.customDomain);
  }
  await prisma.toy.update({
    where: { id: toy.id },
    data: { customDomain: null, domainStatus: "none", domainDnsTarget: null },
  });
  revalidatePath(`/dashboard/toys/${toy.id}`);
}
